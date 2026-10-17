// Part of ccf-web's Dice So Nice integration (AGPL-3.0, see ../LICENSE.md).
// The minimal Foundry VTT globals the vendored Dice So Nice code touches, with Foundry's and
// Dice So Nice's own defaults, so the engine runs unchanged outside Foundry.

// ---- Dice So Nice world settings (defaults from Dice So Nice's main.js) ----
const SETTINGS = {
	settings: {},
	formatVersion: "",
	maxDiceNumber: 20,
	globalAnimationSpeed: "0",
	enabledSimultaneousRolls: true,
	diceCanBeFlipped: true,
	showGhostDice: false,
	// No persistent/grabbable dice on the site: rolls only come from the chat.
	allowInteractivity: false,
	persistentDice: false,
	forceCharacterOwnerAppearance: "2",
	forceCharacterOwnerAppearanceForInitiative: false,
	damageTypeMap: {},
	documentsForPreload: [],
	customDiceTerms: {},
};

// ---- foundry.utils ----
function isPlainObject(v) {
	return v !== null && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype;
}

function deepClone(v) {
	if (Array.isArray(v)) return v.map(deepClone);
	if (isPlainObject(v)) {
		const out = {};
		for (const [k, x] of Object.entries(v)) out[k] = deepClone(x);
		return out;
	}
	return v;
}

// Foundry's mergeObject with the defaults Dice So Nice relies on: merges `other` into `original`
// in place (recursively for plain objects), inserting new keys and overwriting values.
function mergeObject(original, other = {}, { inplace = true } = {}) {
	const target = inplace ? original : deepClone(original);
	for (const [k, v] of Object.entries(other ?? {})) {
		if (isPlainObject(v) && isPlainObject(target[k])) mergeObject(target[k], v, { inplace: true });
		else target[k] = v;
	}
	return target;
}

function randomID(length = 16) {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	let id = "";
	for (let i = 0; i < length; i++) id += chars[Math.floor(Math.random() * chars.length)];
	return id;
}

// ---- Audio (Foundry's "interface" channel, Web Audio) ----
let audioContext = null;
function getAudioContext() {
	if (!audioContext) {
		const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
		audioContext = new Ctx();
		// Foundry's default interface volume (core.globalInterfaceVolume) is 0.5.
		audioContext.ccfGain = audioContext.createGain();
		audioContext.ccfGain.gain.value = 0.5;
		audioContext.ccfGain.connect(audioContext.destination);
		const resume = () => audioContext.state === "suspended" && audioContext.resume();
		for (const ev of ["pointerdown", "keydown", "touchstart"]) {
			globalThis.addEventListener?.(ev, resume, { passive: true });
		}
	}
	return audioContext;
}

const bufferCache = new Map();
function loadBuffer(src) {
	if (!bufferCache.has(src)) {
		bufferCache.set(
			src,
			fetch(src)
				.then((r) => r.arrayBuffer())
				.then((data) => getAudioContext().decodeAudioData(data))
		);
	}
	return bufferCache.get(src);
}

// foundry.audio.Sound, as Dice So Nice uses it: load() then play() a sprite segment
// (loopStart → loopEnd) with a volume.
class Sound {
	constructor(src) {
		this.src = src;
		this.buffer = null;
	}

	async load() {
		this.buffer = await loadBuffer(this.src);
		return this;
	}

	play({ loop = false, loopStart = 0, loopEnd, volume = 1, offset } = {}) {
		if (!this.buffer) return;
		const ctx = getAudioContext();
		if (ctx.state === "suspended") ctx.resume();
		const source = ctx.createBufferSource();
		source.buffer = this.buffer;
		const gain = ctx.createGain();
		gain.gain.value = volume;
		source.connect(gain).connect(ctx.ccfGain);
		const start = offset ?? loopStart;
		if (loop) {
			source.loop = true;
			source.loopStart = loopStart;
			if (loopEnd !== undefined) source.loopEnd = loopEnd;
			source.start(0, start);
		} else {
			source.start(0, start, loopEnd !== undefined ? Math.max(0, loopEnd - start) : undefined);
		}
		return this;
	}
}

const AudioHelper = {
	preloadSound(src) {
		return loadBuffer(src);
	},
	async play({ src, volume = 1, loop = false } = {}) {
		const sound = await new Sound(src).load();
		return sound.play({ volume, loop });
	},
};

// ---- PIXI-like ticker (Foundry's canvas.app.ticker): Dice So Nice adds/removes its render loop. ----
class TickerListener {
	constructor(fn, context, ticker) {
		this.fn = fn;
		this.context = context;
		this.ticker = ticker;
		this.next = null;
		this.previous = null;
	}

	// Unlinks the listener and returns the next one (PIXI's contract, used by Utils.removeTicker).
	destroy() {
		const next = this.next;
		if (this.previous) this.previous.next = this.next;
		if (this.next) this.next.previous = this.previous;
		this.next = this.previous = null;
		this.ticker._schedule();
		return next;
	}
}

class Ticker {
	constructor() {
		this._head = new TickerListener(null, null, this);
		this._frame = null;
	}

	add(fn, context) {
		const listener = new TickerListener(fn, context, this);
		let last = this._head;
		while (last.next) last = last.next;
		last.next = listener;
		listener.previous = last;
		this._schedule();
		return this;
	}

	_schedule() {
		if (this._head.next && this._frame === null) {
			this._frame = requestAnimationFrame(() => this._tick());
		}
	}

	// PIXI stops its frame loop when no listener is left.
	_cancelIfNeeded() {
		if (!this._head.next && this._frame !== null) {
			cancelAnimationFrame(this._frame);
			this._frame = null;
		}
	}

	_tick() {
		this._frame = null;
		let listener = this._head.next;
		while (listener) {
			const next = listener.next;
			listener.fn.call(listener.context);
			listener = next;
		}
		this._schedule();
	}
}

// ---- Fonts ----
const FONT_FILES = { FoundryVTT: "/modules/dice-so-nice/fonts/foundryvtt.woff2" };
const FontConfig = {
	getAvailableFonts: () => [],
	getAvailableFontChoices: () => ({}),
	async loadFont(family) {
		const url = FONT_FILES[family];
		if (!url || typeof FontFace === "undefined") return;
		const face = new FontFace(family, `url(${url})`);
		document.fonts.add(await face.load());
	},
};

// ---- Dice terms (Dice So Nice only reads DENOMINATION and instanceof checks) ----
class DiceTerm {}
class Die extends DiceTerm {
	static DENOMINATION = "d";
}
class Coin extends DiceTerm {
	static DENOMINATION = "c";
}
class FateDie extends DiceTerm {
	static DENOMINATION = "f";
}

function makeUser({ id, name, color }) {
	const flags = {};
	return {
		id,
		name,
		color: { toString: () => color },
		isGM: false,
		getFlag: (scope, key) => flags[scope]?.[key],
		setFlag: async (scope, key, value) => {
			(flags[scope] ||= {})[key] = value;
		},
		unsetFlag: async (scope, key) => {
			if (flags[scope]) delete flags[scope][key];
		},
	};
}

/** Installs the globals once, before the Dice So Nice modules run. */
export function installFoundryShim({ userId = "ccf", userName = "Jogador", userColor = "#ffffff" } = {}) {
	if (globalThis.__ccfFoundryShim) return;
	globalThis.__ccfFoundryShim = true;

	const user = makeUser({ id: userId, name: userName, color: userColor });
	const users = new Map([[user.id, user]]);
	users.find = (fn) => [...users.values()].find(fn);
	users.map = (fn) => [...users.values()].map(fn);
	users.filter = (fn) => [...users.values()].filter(fn);

	const ticker = new Ticker();

	globalThis.game = {
		user,
		users,
		settings: {
			get: (scope, key) => SETTINGS[key],
			set: async (scope, key, value) => {
				SETTINGS[key] = value;
			},
			register: (scope, key, data) => {
				if (!(key in SETTINGS)) SETTINGS[key] = data?.default;
			},
		},
		i18n: { localize: (s) => s, format: (s) => s, has: () => false },
		modules: { get: () => undefined },
		audio: {
			get interface() {
				return getAudioContext();
			},
			pending: { push: (fn) => fn() },
		},
		// WebGL2 renderers always have linear float filtering in the browsers we target.
		canvas: { app: { renderer: { context: { webGLVersion: 2, extensions: { floatTextureLinear: true } } } } },
		dice3d: null,
	};

	globalThis.canvas = {
		darknessLevel: 0,
		app: { ticker, renderer: globalThis.game.canvas.app.renderer },
	};

	globalThis.foundry = {
		utils: {
			mergeObject,
			deepClone,
			duplicate: (v) => JSON.parse(JSON.stringify(v)),
			isEmpty: (v) => v == null || (typeof v === "object" && Object.keys(v).length === 0),
			randomID,
			fromUuidSync: () => null,
		},
		audio: { Sound, AudioHelper },
		dice: { terms: { DiceTerm, Die, Coin, FateDie } },
		data: { operators: { ForcedDeletion: class ForcedDeletion {} } },
		applications: { settings: { menus: { FontConfig } } },
	};

	globalThis.Hooks = { call: () => true, callAll: () => true, on: () => 0, once: () => 0, off: () => {} };
	globalThis.ui = {
		notifications: {
			info: (m) => console.info("[Dice So Nice]", m),
			warn: (m) => console.warn("[Dice So Nice]", m),
			error: (m) => console.error("[Dice So Nice]", m),
		},
	};
	globalThis.CONFIG = { Dice: { terms: { d: Die, c: Coin, f: FateDie }, randomUniform: Math.random } };
}
