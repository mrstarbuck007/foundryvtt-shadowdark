# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Foundry VTT **game system** (not a module) implementing Shadowdark RPG. There is no standalone application
to run: the build produces `system/` as a Foundry-installable system directory, which Foundry loads.
`system/system.json` is the manifest (id `shadowdark`, Foundry v13 minimum, v14 verified).

This is a personal fork (`mrstarbuck007/foundryvtt-shadowdark`) and changes are not contributed
back upstream. Do not create pull requests or offer to. Do not create, switch, merge or rebase
branches -- the repository owner handles all branching and merging. Commit and push only when
explicitly asked.

## Commands

```bash
npm run build          # gulp build: css + lang + lint + rollup bundle + packs
npm run build:watch    # default gulp task: build, then watch css/lang/js (has livereload)
npm run lint           # eslint with --fix; rewrites source files in place
npm run css            # scss/ -> system/css/
npm run lang           # i18n/*.yaml -> system/i18n/*.json
npm run packs          # data/packs/**/*.json -> system/packs/ (LevelDB)
npm run export         # system/packs/ (LevelDB) -> data/packs/**/*.json
npm run import         # pack data/packs -> system/packs
npm run notes          # RELEASE_NOTES.md + GitHub wiki -> documentation pack journals
npm run clean          # remove generated css / i18n / packs
npm run createSymlinks # symlink Foundry client sources into ./foundry for intellisense
```

**There is no test suite.** Verification is `npm run lint` + `npm run build`, then loading the system in
Foundry. CI (`.github/workflows/npm-gulp.yml`) runs `npm run notes` then `npm run build` on Node 24 — nothing
more. Releases are cut manually via the `release.yml` workflow_dispatch, which zips `system/`.

### Local Foundry setup

Copy `example-foundry-config.yaml` to `foundry-config.yaml` (gitignored) with your `installPath`, then
`npm run createSymlinks`. Symlink or copy the built `system/` directory into Foundry's `Data/systems/shadowdark`.
`system.json` declares `hotReload` for `css`, `i18n`, and `templates`, so with `npm run build:watch` running,
style/lang/handlebars edits reload without restarting Foundry; JS changes need a browser reload.

## Generated output — never edit by hand

Everything Foundry actually loads is compiled and gitignored:

| Generated | Source of truth |
| --- | --- |
| `system/shadowdark-compiled.mjs` | `system/shadowdark.mjs` + `system/src/**` (rollup, ES bundle + sourcemap) |
| `system/css/` | `scss/` (entry `scss/shadowdark.scss`) |
| `system/i18n/*.json` | `i18n/*.yaml` |
| `system/packs/` | `data/packs/**/*.json` |

Build logic lives in `utils/*.mjs`, wired together by `gulpfile.mjs`.

## Architecture

### Entry point and registration

`system/shadowdark.mjs` is the only rollup input. It builds the `globalThis.shadowdark` / `game.shadowdark`
namespace (`apps`, `chat`, `compendiums`, `config`, `dice`, `documents`, `effects`, `sheets`, `utils`, plus
`log`/`debug`/`warn`/`error`) and does all Foundry registration in the `init` hook: document classes, data
models keyed by document subtype, sheet classes, `CONFIG.Dice.rolls`, handlebars helpers, settings, enrichers,
template preloading. `setup` localizes every string in `CONFIG.SHADOWDARK` in place. `ready` runs migrations,
attaches runtime hooks (`src/hooks/*` via `HooksSD`), and starts the socket listener.

Subdirectories under `system/src/` export through `_module.mjs` barrel files; classes are suffixed `SD`.

### Documents vs. data models

Two parallel hierarchies, both keyed off the document subtype:

- `system/src/documents/` — `ActorSD`, `ItemSD`, `ActiveEffectSD`, `ChatMessageSD` extend Foundry document
  classes. Behavior that applies across subtypes lives here (`_preCreate` defaults, damage application, light
  source toggling).
- `system/src/models/` — `TypeDataModel` schemas: `PlayerSD`/`NpcSD` (extending `_ActorBaseSD`) and one class
  per item type under `models/items/` (extending `_BaseItemSD` / `_PhysicalItemSD`). Shared schema fragments
  live in `models/_fields/` (`actorFields.mjs`, `itemFields.mjs`, `bonuses.mjs`).

Adding a new item/actor subtype requires three coordinated edits: the model class plus its
`models/_module.mjs` export, the `CONFIG.*.dataModels` map in `shadowdark.mjs`, and `documentTypes` in
`system/system.json`.

Legacy field renames are handled with `static migrateData()` on the model where possible (see
`PlayerSD.migrateData`), reserving the migration runner for changes that need document writes.

### Rolls

`system/src/dice/dice.mjs` is a set of free functions operating on a **roll config object** rather than a class
API; `RollSD` (a `foundry.dice.Roll` subclass) only adds success/critical getters and chat rendering. The flow
is: a data model's `rollConfigGenerators` (`check`, `ability`, `spell`, `attack` — declared on `_ActorBaseSD`
and extended by `PlayerSD`) builds the config, `initializeD20Check` seeds it, `rollDialog`/`rollFromConfig`
evaluate it, and formula mutation happens through `applyAdvantage` / `applyCriticalHit` / `applyExploding`.
Damage and rerolls are driven off the config stored on the chat message (`rollDamageFromMessage`,
`rerollFromMessage`), so anything a reroll needs must be present in the config.

`resolveFormula()` is the shared helper for collapsing deterministic formulas against actor roll data.

### Active effects

`ActiveEffectSD.applyRules()` runs before every change is applied (via both the v13 `apply` and v14
`applyChange` overrides) and resolves the change value as a roll formula against the actor's roll data. Keys
whose schema field is integer are forced deterministic and rejected if they don't resolve. `system.attributes.ac`
and any `system.bonuses.*` key are **rejected outright** — those are schema objects; target the leaf instead
(e.g. `system.attributes.ac.value`, or a specific bonus field). `legacyTransferral` is off.

Effects are auto-suppressed when their parent item is stashed, unequipped-but-equippable, or unidentified.
The `shadowdark.situational` flag marks effects the player toggles per-roll.
`system/src/system/ActiveEffectsSD.mjs` handles predefined effects and `REPLACEME` placeholders, which prompt
the user for a value (e.g. which weapon or spell) when the item is created.

`system.bonuses` (`models/_fields/bonuses.mjs`) is the canonical list of mechanical hooks talents can target.

### Migrations

`system/src/migrations/updates/Update_YYMMDD_N.mjs` classes extend `UpdateBaseSD` and implement any of
`updateActor`, `updateItem`, `updateSettings`, each returning an update-data object. `static version` is a
`YYMMDD.N` **number**. `MigrationRunnerSD` collects everything exported from `updates/_module.mjs`, keeps those
newer than the `schemaVersion` setting, sorts by version, and applies them to world documents and (optionally)
system compendiums. A new migration is a new file plus its export line in `updates/_module.mjs`.

### Compendium content

Pack content is version-controlled as one pretty-printed JSON file per document in `data/packs/<pack>.db/`,
named `<slug>__<id>.json` with a `_key` field encoding its collection path. Edit those files and run
`npm run packs`; to pull changes made inside Foundry back into git, run `npm run export` (unpacks the LevelDB
in `system/packs`) and commit the JSON diff. `utils/lib/pack-handler.mjs`, also exposed as the `smelter.mjs`
CLI, handles both LevelDB and legacy NeDB.

`CompendiumsSD` is the single accessor layer for compendium content — `shadowdark.compendiums.weapons()`,
`.classTalents()`, etc. It scans *all* loaded packs (so module-provided content participates) and applies the
user's `sourceFilters` setting. Don't query `game.packs` directly for game content; add a method here instead.

`npm run notes` rewrites journal JSON inside `data/packs/documentation.db/` from `RELEASE_NOTES.md` and from
sections of the GitHub wiki's `Data-Model-References` page — so those journals are generated, not hand-edited.

### Sheets and templates

Sheets in `system/src/sheets/` still extend the **AppV1** classes (`foundry.appv1.sheets.ActorSheet` /
`ItemSheet`) with jQuery `activateListeners` and `[data-action]` selectors; `system/src/apps/` holds the
standalone applications (importers, character generator, level-up, light source tracker, spell book, effect
panel). Handlebars templates live in `system/templates/`, and every partial must be listed in
`system/src/templates.mjs` to be preloaded.

### Localization

Only `i18n/en.yaml` is edited by hand — all other locales are managed by Crowdin (`crowdin.yml`) and land via
`l10n_develop` PRs. Keys are dotted under the `SHADOWDARK.` prefix.

## Code style

Enforced by `.eslintrc.json` (legacy eslintrc format, run through `gulp-eslint-new` with `fix: true`, so
`npm run lint` edits files) and `.editorconfig`: **tabs** for indentation, double quotes, semicolons,
100-column max, Stroustrup brace style (`}` newline `else`), `catch(err)` with no space before the paren,
trailing commas on multiline arrays/objects/imports but never on function args, LF line endings.
