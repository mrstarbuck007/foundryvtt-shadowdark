import * as itemfields from "../_fields/itemFields.mjs";
import { BaseItemSD } from "./_BaseItemSD.mjs";

const fields = foundry.data.fields;

export default class SpellSD extends BaseItemSD {
	static defineSchema() {
		const schema = {
			...itemfields.magic(),
			tier: new fields.NumberField({ integer: true, initial: 1}),
		};

		return Object.assign(super.defineSchema(), schema);
	}

	static migrateData(data) {
		// migrate for NPC Spell
		if (data.dc) {
			data.tier = data.dc - 10;
		}
		return super.migrateData(data);
	}

	/**
	 * triggered after Active Effects are applied
	 * @override
	 */
	prepareDerivedData() {
		super.prepareDerivedData();

		// support for NPC spells
		this.dc = this.tier + 10;
	}

	/* ----------------------- */
	/* Getters                 */
	/* ----------------------- */

	get isRollable() {
		return true;
	}

	get isSpell() {
		return true;
	}

	get subtext() {
		const tier = `${game.i18n.localize("SHADOWDARK.item.spell_tier")} ${this.tier}`;
		const range = Handlebars.helpers.fromConfig("SPELL_RANGES", this.range);
		const duration = Handlebars.helpers.getSpellDuration(
			this.duration.type, this.duration.value
		);
		return [tier, range, duration].filter(Boolean).join(" • ");
	}

	async getClassNames() {
		const spellName = this.parent.name;
		const pack = game.packs.get("shadowdark.spells");
		if (!pack) return;

		const index = await pack.getIndex({ fields: ["system.class"] });

		const classUuids = new Set();
		for (const entry of index) {
			if (entry.name !== spellName) continue;
			for (const uuid of entry.system?.class ?? []) classUuids.add(uuid);
		}

		const classes = await Promise.all([...classUuids].map(uuid => fromUuid(uuid)));
		return classes
			.filter(Boolean)
			.map(c => c.name)
			.sort((a, b) => a.localeCompare(b))
			.join(", ");
	}

}
