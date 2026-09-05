import { UpdateBaseSD } from "../UpdateBaseSD.mjs";

export default class Update_260904_2 extends UpdateBaseSD {

	static version = 260904.2;

	async updateItem(itemData) {
		if (itemData.type !== "Spell") return;
		if (itemData.system?.range !== "touch") return;

		shadowdark.log(`Changing "${itemData.name}" range from "touch" to "close"`);

		return {"system.range": "close"};
	}
}
