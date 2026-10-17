// Part of ccf-dices-module (AGPL-3.0, see ../../LICENSE.md).
// The module's entry point for ccf-web's module system (module API v1): registers Dice So Nice as
// the table's 3D dice renderer. The engine itself (three.js, physics worker, textures, sounds) is only
// loaded on the first throw, or when the site preloads it.
import { getDice3D } from "./index.js";

// Same list as SUPPORTED_FACES in Dice3DLite.js (not imported, so the engine isn't loaded up front).
const SIDES = [2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20, 24, 30, 100];

/** Called by the site once the module is enabled on the table. */
export function activate(ccf) {
	let loaded = null;
	const engine = () => (loaded ??= getDice3D({ userId: ccf.user?.id, userName: ccf.user?.name }).catch((err) => {
		loaded = null;
		throw err;
	}));

	ccf.dice.registerRenderer({
		sides: SIDES,
		preload: () => engine().then(() => undefined),
		setAppearance: async (appearance) => (await engine()).setAppearance(appearance),
		show: async (dice) => (await engine()).show(dice),
		hideNow() {
			loaded?.then((d) => d.hideNow()).catch(() => {});
		},
	});
}
