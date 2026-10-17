// Part of ccf-web's Dice So Nice integration (AGPL-3.0, see ../LICENSE.md).
// Entry point: installs the Foundry globals first, then loads the engine (dynamic import, so the
// Dice So Nice modules only run once the globals exist).
import { installFoundryShim } from "./foundry-shim.js";

let dice3d = null;

/** Creates (once) and initializes the dice engine. */
export function getDice3D(options) {
	if (!dice3d) {
		installFoundryShim(options);
		dice3d = import("./Dice3DLite.js")
			.then(async ({ Dice3DLite }) => {
				const instance = new Dice3DLite();
				await instance.init();
				return instance;
			})
			.catch((err) => {
				dice3d = null;
				throw err;
			});
	}
	return dice3d;
}
