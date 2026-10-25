// Part of ccf-web's Dice So Nice integration (AGPL-3.0, see ../LICENSE.md).
// A slimmed-down Dice3D (Dice So Nice 6.2.9, module/Dice3D.js): builds the dice box, preloads
// textures/sounds/presets and plays throws with the same queue, simultaneous-roll window and
// hide/fade timing as the Foundry module. Rolls come from ccf-web's chat instead of Foundry Rolls.

import { DiceFactory } from "../engine/DiceFactory.js";
import { DiceBox } from "../rendering/DiceBox.js";
import { DiceColors, TEXTURELIST } from "../engine/DiceColors.js";
import { DiceNotation, COMPOUND_DICE } from "../DiceNotation.js";
import { DiceSFXManager } from "../sfx/DiceSFXManager.js";
import { Accumulator } from "../Accumulator.js";
import { ThinFilmFresnelMap } from "../libs/ThinFilmFresnelMap.js";
import { DiceLibrary } from "../engine/DiceLibrary.js";
import { CustomDiceTerms } from "../engine/CustomDiceTerms.js";
import { TextureLoader } from "three";

// Dice So Nice's DEFAULT_OPTIONS at a "medium" quality — the "high" one stuttered here, since the dice
// draw over ccf-web's own board instead of sharing Foundry's canvas: 2048 shadows instead of 4096,
// no bloom (it drew the scene twice per frame plus blur passes), SMAA instead of 4x MSAA, plain glass
// and the screen's density capped at 1.5x (DiceScene.js). The dice also leave sooner (players found
// the 2s wait + 1s fade too long next to the sheet).
const DEFAULT_OPTIONS = {
	enabled: true,
	visibility: "all",
	protectPersistent: false,
	showExtraDice: false,
	hideAfterRoll: true,
	timeBeforeHide: 1000,
	hideFX: "fadeOut",
	autoscale: true,
	scale: 75,
	speed: 1,
	imageQuality: "medium",
	shadowQuality: "medium",
	bumpMapping: true,
	sounds: true,
	soundsSurface: "felt",
	soundsVolume: 0.5,
	canvasZIndex: "over",
	throwingForce: "medium",
	useHighDPI: true,
	antialiasing: "smaa",
	glow: false,
	persistentDiceOutlines: true,
	advancedGlass: false,
	ambiance: "foyer_1k",
	showOthersSFX: true,
	immersiveDarkness: true,
	muteSoundSecretRolls: false,
	enableFlavorColorset: true,
	skipAnimationOnInactiveTab: false,
	rollingArea: false,
	persistentDiceSpawnLocation: "center",
};

// Dice the engine can show (same list as DiceNotation).
// How long the stopped dice take to fade away.
const FADE_MS = 400;
// Rolls arriving this close together land in the same throw (Dice So Nice uses 400ms).
const SIMULTANEOUS_MS = 150;

export const SUPPORTED_FACES = new Set([2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20, 24, 30, 100]);

export class Dice3DLite {
	static get DEFAULT_OPTIONS() {
		return { ...DEFAULT_OPTIONS };
	}

	static DEFAULT_APPEARANCE() {
		return { global: { ...Dice3DLite.appearance } };
	}

	// Appearance of the local player's dice (Dice So Nice's "global" appearance block).
	static appearance = {
		labelColor: "#000000",
		diceColor: "#ffffff",
		outlineColor: "#000000",
		edgeColor: "#000000",
		texture: "none",
		material: "auto",
		font: "auto",
		colorset: "custom",
		system: "standard",
	};

	constructor() {
		this.dice3dRenderers = { board: null, showcase: null, editor: null };
		this._iridescenceLookUp = null;
		this._iridescenceNoise = null;
		const self = this;
		this.uniforms = {
			globalBloom: { value: 1 },
			bloomStrength: { value: 1.1 },
			bloomRadius: { value: 0.2 },
			bloomThreshold: { value: 0 },
			iridescenceLookUp: {
				get value() {
					return (self._iridescenceLookUp ??= new ThinFilmFresnelMap());
				},
				set value(v) {
					self._iridescenceLookUp = v;
				},
			},
			iridescenceNoise: {
				get value() {
					return (self._iridescenceNoise ??= new TextureLoader().load("/modules/dice-so-nice/textures/noise-thin-film.webp"));
				},
				set value(v) {
					self._iridescenceNoise = v;
				},
			},
			boost: { value: 1.5 },
			time: { value: 0 },
		};
		this.queue = [];
		this._currentAnimation = Promise.resolve();
		game.dice3d = this;
	}

	/** Builds the canvas and the box, then preloads everything (like Dice3D.init). */
	async init() {
		this._buildCanvas();
		this.DiceFactory = new DiceFactory();
		CustomDiceTerms.registerPresetsInFactory(this.DiceFactory);
		const config = { ...DEFAULT_OPTIONS, appearance: Dice3DLite.DEFAULT_APPEARANCE(), boxType: "board" };
		config.dimensions = this._computeDimensions();
		this.box = new DiceBox(this.canvas, this.DiceFactory, config);
		await this.box.initialize();
		this.diceLibrary = new DiceLibrary();

		await new Promise((resolve) => DiceColors.loadTextures(TEXTURELIST, resolve));
		DiceColors.initColorSets();
		await this.DiceFactory._loadFonts();
		await this.diceLibrary.load();
		await DiceLibrary.preloadAssets();
		await this.DiceFactory.preloadPresets(true, null, Dice3DLite.DEFAULT_APPEARANCE());

		DiceSFXManager.init();
		this._initQueue();
		this._initResize();
		this.canvas.style.display = "none";
		this._initDismiss();
	}

	// A click, tap or key press while the dice are lying still sends them away at once.
	_initDismiss() {
		const dismiss = () => {
			if (this.canvas.style.display !== "none" && !this.box.rolling && this.timeoutHandle) {
				clearTimeout(this.timeoutHandle);
				this.timeoutHandle = null;
				this._fadeOutCanvas(FADE_MS / 2, () => this.box.clearAll());
			}
		};
		window.addEventListener("pointerdown", dismiss, { passive: true });
		window.addEventListener("keydown", dismiss);
	}

	_computeDimensions() {
		return {
			width: window.innerWidth,
			height: window.innerHeight - 1,
			margin: { top: 0, right: 0, bottom: 0, left: 0 },
		};
	}

	_buildCanvas() {
		this.canvas = document.createElement("div");
		this.canvas.id = "dice-box-canvas";
		this.canvas.setAttribute("aria-hidden", "true");
		this.canvas.style.cssText = "position: fixed; left: 0; top: 0; pointer-events: none; z-index: 1100;";
		this.canvas.style.width = window.innerWidth + "px";
		this.canvas.style.height = window.innerHeight - 1 + "px";
		document.body.append(this.canvas);
	}

	_initResize() {
		let timer = null;
		window.addEventListener("resize", () => {
			clearTimeout(timer);
			// Like Dice So Nice: wait for the resize to end and for the current throw to finish.
			timer = setTimeout(() => {
				this._currentAnimation.then(() => {
					this.canvas.style.width = window.innerWidth + "px";
					this.canvas.style.height = window.innerHeight - 1 + "px";
					this.box.updateBoundaries(this._computeDimensions());
				});
			}, 1000);
		});
	}

	/** Changes the local dice appearance (colors/material) for the next throws. */
	async setAppearance(appearance) {
		Dice3DLite.appearance = { ...Dice3DLite.appearance, ...appearance };
		await this.DiceFactory.preloadPresets(true, null, Dice3DLite.DEFAULT_APPEARANCE());
	}

	/**
	 * Throws dice that land on the given values. Resolves when they stop (false if not shown).
	 * @param {{faces:number, value:number}[]} dice
	 */
	show(dice) {
		const notation = this._notation(dice.filter((d) => SUPPORTED_FACES.has(d.faces)));
		if (!notation.throws[0].dice.length) return Promise.resolve(false);
		notation.dsnConfig = {
			appearance: Dice3DLite.DEFAULT_APPEARANCE(),
			specialEffects: [],
			diceLibrary: DiceLibrary.getLibraryForUser(game.user),
		};
		return new Promise((resolve) => this.nextAnimation.addItem({ params: notation, resolve }));
	}

	// Same die objects DiceNotation builds from a Foundry Roll (d100 as tens + units dice).
	_notation(dice) {
		const throws = [{ dice: [] }];
		const options = { owner: game.user.id };
		for (const { faces, value } of dice) {
			const fvttResult = { result: value, active: true, indexThrow: 0 };
			const base = { vectors: [], options: { ...options }, fvttResult, termIndex: 0, termNumber: 1, termTotal: value, termFaces: faces, termModifiers: [] };
			const places = COMPOUND_DICE[faces];
			if (places) {
				for (const place of places) {
					const digit = Math.floor(value / place.divisor) % 10;
					throws[0].dice.push({
						...base,
						options: { ...options },
						type: place.type,
						result: digit,
						resultLabel: String(digit * place.divisor),
						compositeResult: value,
						compositeType: "d" + faces,
					});
				}
			} else {
				throws[0].dice.push({ ...base, type: "d" + faces, result: value, resultLabel: String(value) });
			}
		}
		return { throws };
	}

	// Dice So Nice's queue: rolls within SIMULTANEOUS_MS land together; the rest wait their turn.
	_initQueue() {
		const timing = game.settings.get("dice-so-nice", "enabledSimultaneousRolls") ? SIMULTANEOUS_MS : 0;
		this.nextAnimation = new Accumulator(timing, async (items) => {
			if (this.queue.length >= 10) {
				items.forEach((item) => item.resolve(false));
				return;
			}
			const batches = DiceNotation.mergeQueuedRollCommands(items);
			let remaining = batches.length;
			this._currentAnimation = this._currentAnimation.then(async () => {
				for (const batch of batches) {
					this.queue.push(
						() =>
							new Promise(async (resolve) => {
								this._beforeShow();
								await this.box.startUnifiedBatch(batch, null, () => {
									remaining--;
									if (remaining === 0) {
										items.forEach((item) => item.resolve(true));
										this._afterShow();
									}
									resolve();
								});
							})
					);
				}
				return this._processQueue();
			});
			await this._currentAnimation;
		});
	}

	async _processQueue() {
		while (this.queue.length) await this.queue.shift()();
	}

	_beforeShow() {
		if (this.timeoutHandle) clearTimeout(this.timeoutHandle);
		this.box.cancelFade();
		this._cancelCanvasFade();
		this.canvas.style.display = "";
		this.canvas.style.opacity = "";
	}

	_afterShow() {
		if (DiceSFXManager.renderQueue.length) {
			clearTimeout(this.timeoutHandle);
			return;
		}
		this.timeoutHandle = setTimeout(() => {
			this.timeoutHandle = null;
			if (!this.box.rolling) this._fadeOutCanvas(FADE_MS, () => this.box.clearAll());
		}, DEFAULT_OPTIONS.timeBeforeHide);
	}

	/** Hides the dice right away (e.g. 3D dice switched off). */
	hideNow() {
		if (this.timeoutHandle) clearTimeout(this.timeoutHandle);
		this._cancelCanvasFade();
		this.canvas.style.display = "none";
		if (!this.box.rolling) this.box.clearAll();
	}

	_fadeOutCanvas(duration, complete) {
		this._cancelCanvasFade();
		this.canvas.style.transition = `opacity ${duration}ms ease`;
		this.canvas.style.opacity = "0";
		this._canvasFadeTimer = setTimeout(() => {
			this.canvas.style.display = "none";
			this.canvas.style.transition = "";
			this.canvas.style.opacity = "";
			this._canvasFadeTimer = null;
			if (complete) complete();
		}, duration);
	}

	_cancelCanvasFade() {
		if (this._canvasFadeTimer) {
			clearTimeout(this._canvasFadeTimer);
			this._canvasFadeTimer = null;
		}
		this.canvas.style.transition = "";
	}
}
