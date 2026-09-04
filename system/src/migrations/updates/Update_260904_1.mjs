import { UpdateBaseSD } from "../UpdateBaseSD.mjs";

// Sources that were folded into Shadowdark RPG: The Western Reaches, which reprints them
const RETIRED_SOURCES = [
	"bard-and-ranger",
	"cursed-scroll-1",
	"cursed-scroll-2",
	"cursed-scroll-3",
	"cursed-scroll-4",
	"cursed-scroll-5",
	"cursed-scroll-6",
];

export default class Update_260904_1 extends UpdateBaseSD {

	static version = 260904.1;

	async updateItem(itemData) {
		const source = itemData.system?.source?.title;
		if (!RETIRED_SOURCES.includes(source)) return;

		shadowdark.log(`Retagging "${itemData.name}" source from "${source}" to "western-reaches"`);

		return {"system.source.title": "western-reaches"};
	}
}
