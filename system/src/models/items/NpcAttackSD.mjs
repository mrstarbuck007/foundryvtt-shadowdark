import * as itemfields from "../_fields/itemFields.mjs";
import { BaseItemSD } from "./_BaseItemSD.mjs";

const fields = foundry.data.fields;

export default class NpcAttackSD extends BaseItemSD {
	static defineSchema() {
		const schema = {
			...itemfields.ranges(),
			attack: new fields.SchemaField({
				num: new fields.NumberField({ integer: true, initial: 1, min: 1 }),
			}),
			bonuses: new fields.SchemaField({
				attackBonus: new fields.NumberField({ integer: true, initial: 0, min: 0 }),
				critical: new fields.SchemaField({
					failureThreshold: new fields.NumberField({ integer: true, initial: 1}),
					multiplier: new fields.NumberField({ integer: true, initial: 2}),
					successThreshold: new fields.NumberField({ integer: true, initial: 20}),
				}),
				damageBonus: new fields.NumberField({ integer: true, initial: 0, min: 0 }),
			}),
			damage: new fields.SchemaField({
				numDice: new fields.NumberField({ integer: true, initial: 1, min: 1 }),
				special: new fields.StringField(),
				value: new fields.StringField(),
			}),
		};

		return Object.assign(super.defineSchema(), schema);
	}

	get subtext() {
		const ranges = this.ranges
			.map(r => game.i18n.localize(CONFIG.SHADOWDARK.RANGES[r]))
			.join("/");
		return [ranges, this.damage.special].filter(Boolean).join(" • ");
	}

	async getDescription() {
		const parts = [await super.getDescription()];

		if (this.damage?.special) {
			const featureNames = this.damage.special
				.split(",")
				.map(s => s.trim().toLowerCase());

			for (const name of featureNames) {
				const feature = this.parent.actor?.items.find(
					i => i.system.isNPCFeature && i.name.toLowerCase() === name
				);
				if (!feature) continue;

				const featureDesc = await feature.system.getDescription();
				const header = `<strong>${feature.name}.</strong> `;
				const desc = featureDesc.startsWith("<p>")
					? featureDesc.replace("<p>", `<p>${header}`)
					: header + featureDesc;
				parts.push(desc);
			}
		}

		return parts.join("");
	}

}
