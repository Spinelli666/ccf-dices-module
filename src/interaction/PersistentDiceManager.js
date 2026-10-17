import { DiceSFXManager } from '../sfx/DiceSFXManager.js';
import { SFXFormulaMatcher } from '../sfx/SFXFormulaMatcher.js';
import { COMPOUND_DICE } from '../DiceNotation.js';
import { LEGACY_TO_METERS, GRAB_LIFT_PERSISTENT } from '../engine/SceneConstants.js';

import {
	Euler,
	Group,
	Quaternion
} from 'three';

//owns persistent dice CRUD, visibility modes, link group management,
//selection state, multiplayer event emission, persistent throw execution and replay
export class PersistentDiceManager {

	constructor(diceScene, physicsWorker, diceFactory, soundManager) {
		this.diceScene = diceScene;
		this.physicsWorker = physicsWorker;
		this.dicefactory = diceFactory;
		this.soundManager = soundManager;
		this.throwEngine = null;

		this.persistentDiceList = [];
		this.selectedPersistentDiceIds = new Set();
		this.persistentDiceVisibility = "all";

		//set by DiceBox to the DiceBox instance - SFX subclasses access box.scene, box.camera, etc.
		this.sfxContext = null;

		//callback for persistent dice multiplayer sync (set by Dice3D via DiceBox)
		this.onPersistentEvent = null;
		//callback when selection changes (DiceBox updates outline passes)
		this.onSelectionChanged = null;
		//callback at end of replayRemoteThrow (DiceBox triggers updateRemoteOutlines)
		this.onRemoteThrowReplayed = null;
		//callback to route persistent throws through the animation queue (set by Dice3D)
		this.onQueueThrow = null;
		//callback to resolve SFX list for a user (set by Dice3D via DiceBox)
		this.sfxListForUser = null;

		//reusable scratch objects for remote pre-roll rotation (avoid per-frame allocations)
		this._preRollEuler = new Euler(0, 0, 0, 'XYZ');
		this._preRollDeltaQuat = new Quaternion();
	}

	setThrowEngine(throwEngine) {
		this.throwEngine = throwEngine;
	}

	_getPersistentTextureCache() {
		if (!this._persistentTextureCache) {
			const boardCache = this.diceScene.renderer.scopedTextureCache;
			this._persistentTextureCache = { ...boardCache, type: "persistent" };
		}
		return this._persistentTextureCache;
	}

	//spawn a persistent die on the tabletop
	async spawnPersistentDie(type, appearance, position = null, diceLibrary = null, opts = {}) {
		//cap persistent dice at maxDiceNumber
		const maxDiceNumber = game.settings.get("dice-so-nice", "maxDiceNumber");
		if (this.persistentDiceList.length >= maxDiceNumber) {
			ui.notifications?.warn(game.i18n?.localize?.("DICESONICE.persistentDiceCapReached") || `Dice So Nice: persistent dice limit reached (${maxDiceNumber}).`);
			return null;
		}

		const result = await this.throwEngine.createDiceMesh(type, appearance, diceLibrary, this._getPersistentTextureCache());
		if (!result) return null;
		const { dicemesh, diceobj, mass } = result;

		let posX, posY;
		if (position) {
			posX = (position.x - 0.5) * this.diceScene.display.innerWidth;
			posY = -(position.y - 0.5) * this.diceScene.display.innerHeight;
		} else {
			posX = (Math.random() - 0.5) * this.diceScene.display.innerWidth * 0.5;
			posY = -(Math.random() - 0.5) * this.diceScene.display.innerHeight * 0.5;
		}

		//axis must be zero or normalized (cannon-es NaN otherwise)
		const vectordata = {
			type: type,
			pos: { x: posX, y: diceobj.inertia * 13 * LEGACY_TO_METERS, z: posY },
			velocity: { x: 0, y: 0, z: 0 },
			angle: { x: Math.random() * Math.PI * 2, y: Math.random() * Math.PI * 2, z: Math.random() * Math.PI * 2 },
			axis: { x: 0, y: 0, z: 0, a: 0 }
		};

		dicemesh.notation = vectordata;
		dicemesh.result = null;
		dicemesh.stopped = 0;
		dicemesh.startAtIteration = 0;
		dicemesh.options = {};
		dicemesh.userData.persistent = true;
		dicemesh.userData.persistentId = opts.remotePersistentId || foundry.utils.randomID();
		dicemesh.userData.ownerUserId = opts.ownerUserId || game.user?.id || null;
		if (opts.linkGroupId) dicemesh.userData.linkGroupId = opts.linkGroupId;
		if (opts.linkGroupSecondary) dicemesh.userData.linkGroupSecondary = true;
		if (opts.digitPlace != null) dicemesh.userData.digitPlace = opts.digitPlace;

		try {
			await this.physicsWorker.exec('createDice', {
				id: dicemesh.id,
				shape: diceobj.shape,
				material: appearance.material,
				vectordata: vectordata,
				mass: mass,
				startAtIteration: 0,
				options: { persistent: true }
			});

			await this.physicsWorker.exec('addDice', dicemesh.id);
		} catch (error) {
			console.error("[Dice So Nice] Failed to create physics body for persistent die", error);
			dicemesh.geometry?.dispose();
			dicemesh.material?.dispose();
			return null;
		}

		let objectContainer = new Group();
		if(dicemesh.userData.modelScale){
			objectContainer.scale.setScalar(dicemesh.userData.modelScale);
		}
		objectContainer.add(dicemesh);
		objectContainer.position.set(vectordata.pos.x, vectordata.pos.y, vectordata.pos.z);
		this.diceScene.scene.add(objectContainer);

		this.persistentDiceList.push(dicemesh);
		this._emitPersistentDiceChanged();

		//apply current visibility mode
		this._applyPersistentDieVisibility(dicemesh);

		//ghostify remote dice in "mine" mode
		if (this.persistentDiceVisibility === "mine" && !this._isOwnedByLocalUser(dicemesh)) {
			this.physicsWorker.exec('setCollisionResponse', { ids: [dicemesh.id], enabled: false });
		}

		return dicemesh;
	}

	async removePersistentDie(persistentId) {
		const index = this.persistentDiceList.findIndex(d => d.userData.persistentId === persistentId);
		if (index === -1) return;

		const dicemesh = this.persistentDiceList[index];
		this.persistentDiceList.splice(index, 1);
		this._emitPersistentDiceChanged();

		//drop from selection set
		if (this.selectedPersistentDiceIds.delete(dicemesh.id)) {
			if (this.onSelectionChanged) this.onSelectionChanged();
		}

		this.diceScene.scene.remove(dicemesh.parent.type === "Scene" ? dicemesh : dicemesh.parent);
		await this.physicsWorker.exec("removeDice", [dicemesh.id]);
	}

	//count persistent dice for a user, optionally filtered by type
	countPersistentDiceByOwner(userId = null, type = null, opts = {}) {
		const uid = userId ?? game.user?.id ?? null;
		const includeSecondary = opts.includeLinkSecondary === true;
		let count = 0;
		for (const mesh of this.persistentDiceList) {
			if (mesh.userData.ownerUserId !== uid) continue;
			if (type && mesh.notation?.type !== type) continue;
			if (!includeSecondary && mesh.userData.linkGroupSecondary) continue;
			count++;
		}
		return count;
	}

	//find the most recent persistent die of a given type for the toolbox "−" button
	findMostRecentPersistentDie(type, userId = null, opts = {}) {
		const uid = userId ?? game.user?.id ?? null;
		const includeSecondary = opts.includeLinkSecondary === true;
		for (let i = this.persistentDiceList.length - 1; i >= 0; i--) {
			const mesh = this.persistentDiceList[i];
			if (mesh.userData.ownerUserId !== uid) continue;
			if (mesh.notation?.type !== type) continue;
			if (!includeSecondary && mesh.userData.linkGroupSecondary) continue;
			return mesh;
		}
		return null;
	}

	applyVisibility(mode) {
		if (mode !== "none" && mode !== "mine" && mode !== "all") return;
		this.persistentDiceVisibility = mode;

		const ghostIds = [];
		const unghostIds = [];

		for (const mesh of this.persistentDiceList) {
			this._applyPersistentDieVisibility(mesh);
			if (mode === "mine" && !this._isOwnedByLocalUser(mesh)) {
				ghostIds.push(mesh.id);
			} else {
				unghostIds.push(mesh.id);
			}
		}

		if (ghostIds.length > 0) {
			this.physicsWorker.exec('setCollisionResponse', { ids: ghostIds, enabled: false });
		}
		if (unghostIds.length > 0) {
			this.physicsWorker.exec('setCollisionResponse', { ids: unghostIds, enabled: true });
		}
	}

	_isOwnedByLocalUser(mesh) {
		const owner = mesh.userData.ownerUserId;
		return !!(owner && game.user && owner === game.user.id);
	}

	_emitPersistentDiceChanged() {
		try {
			Hooks.callAll("dice-so-nice.persistentDiceChanged");
		} catch (err) {
			console.error("[Dice So Nice] persistentDiceChanged hook listener threw:", err);
		}
	}

	_applyPersistentDieVisibility(dicemesh) {
		const container = dicemesh.parent;
		if (!container) return;
		let visible;
		switch (this.persistentDiceVisibility) {
			case "none": visible = false; break;
			case "mine": visible = this._isOwnedByLocalUser(dicemesh); break;
			case "all":
			default: visible = true; break;
		}
		container.visible = visible;
	}

	//remove persistent dice (ownerUserId filters by owner, null = all)
	async clearPersistentDice({ ownerUserId = null } = {}) {
		const remove = [];
		for (const mesh of this.persistentDiceList) {
			if (!ownerUserId || mesh.userData.ownerUserId === ownerUserId) remove.push(mesh);
		}
		if (remove.length === 0) return;

		const removedIds = remove.map(d => d.id);
		for (const dicemesh of remove) {
			this.diceScene.scene.remove(dicemesh.parent.type === "Scene" ? dicemesh : dicemesh.parent);
			this.selectedPersistentDiceIds.delete(dicemesh.id);
			const idx = this.persistentDiceList.indexOf(dicemesh);
			if (idx !== -1) this.persistentDiceList.splice(idx, 1);
		}
		this._emitPersistentDiceChanged();
		if (this.onSelectionChanged) this.onSelectionChanged();

		if (this.physicsWorker) {
			await this.physicsWorker.exec("removeDice", removedIds);
		}

		// free persistent material cache when all persistent dice are gone
		if (this.persistentDiceList.length === 0) {
			this.dicefactory.disposeCachedMaterials("persistent");
			this._persistentTextureCache = null;
		}
	}

	//delete selected persistent dice (respects ownership, expands link groups)
	async removeSelectedPersistentDice() {
		if (this.selectedPersistentDiceIds.size === 0) return 0;

		const isGM = !!game.user?.isGM;
		const myId = game.user?.id ?? null;

		//collect persistentIds the user is allowed to remove
		const allowedIds = new Set();
		const linkGroups = new Set();
		for (const mesh of this.persistentDiceList) {
			if (!this.selectedPersistentDiceIds.has(mesh.id)) continue;
			const ownedByMe = mesh.userData.ownerUserId === myId;
			if (!isGM && !ownedByMe) continue;
			allowedIds.add(mesh.userData.persistentId);
			if (mesh.userData.linkGroupId) linkGroups.add(mesh.userData.linkGroupId);
		}

		//expand link groups (d100 pair)
		if (linkGroups.size > 0) {
			for (const mesh of this.persistentDiceList) {
				if (mesh.userData.linkGroupId && linkGroups.has(mesh.userData.linkGroupId)) {
					allowedIds.add(mesh.userData.persistentId);
				}
			}
		}

		if (allowedIds.size === 0) return allowedIds;

		await Promise.all(
			Array.from(allowedIds, id => this.removePersistentDie(id))
		);
		return allowedIds;
	}

	getSelectedPersistentDice() {
		if (this.selectedPersistentDiceIds.size === 0) return [];
		const result = [];
		for (const mesh of this.persistentDiceList) {
			if (this.selectedPersistentDiceIds.has(mesh.id)) result.push(mesh);
		}
		return result;
	}

	clearPersistentSelection() {
		if (this.selectedPersistentDiceIds.size === 0) return;
		this.selectedPersistentDiceIds.clear();
		if (this.onSelectionChanged) this.onSelectionChanged();
	}

	//return all dice in the same link group (d100 pair)
	getLinkGroupSiblings(dicemesh) {
		const lg = dicemesh.userData?.linkGroupId;
		if (!lg) return [dicemesh];
		const siblings = [];
		for (const m of this.persistentDiceList) {
			if (m.userData?.linkGroupId === lg) siblings.push(m);
		}
		return siblings.length > 0 ? siblings : [dicemesh];
	}

	togglePersistentSelection(dicemesh) {
		//toggle whole link group together
		const siblings = this.getLinkGroupSiblings(dicemesh);
		const wasSelected = this.selectedPersistentDiceIds.has(dicemesh.id);
		for (const m of siblings) {
			if (wasSelected) this.selectedPersistentDiceIds.delete(m.id);
			else this.selectedPersistentDiceIds.add(m.id);
		}
		if (this.onSelectionChanged) this.onSelectionChanged();
	}

	async addRemoteConstraints(meshes) {
		for (const mesh of meshes) {
			const container = mesh.parent;
			const pos = container
				? { x: container.position.x, y: GRAB_LIFT_PERSISTENT, z: container.position.z }
				: { x: 0, y: GRAB_LIFT_PERSISTENT, z: 0 };
			await this.physicsWorker.exec("addConstraint", { id: mesh.id, pos });
		}
	}

	async removeRemoteConstraints(meshes) {
		if (meshes.length === 0) return;
		await this.physicsWorker.exec("removeConstraint", { ids: meshes.map(m => m.id) });
	}

	//per-frame: remote pre-roll visual rotation + remote move interpolation
	updateRemoteAnimations(timeDiff) {
		//remote pre-roll: same visual effect for dice held by other players
		for (const dicemesh of this.persistentDiceList) {
			if (!dicemesh.userData?.remotePreRoll) continue;
			const r = dicemesh.userData?.preRollRates;
			if (!r) continue;
			r.t += timeDiff;
			const ex = r.x * timeDiff;
			const ey = r.y * timeDiff;
			const w = 2 * Math.PI * r.zFreq;
			const ez = r.zAmp * w * Math.cos(w * r.t) * timeDiff;
			this._preRollEuler.set(ex, ey, ez, 'XYZ');
			this._preRollDeltaQuat.setFromEuler(this._preRollEuler);
			dicemesh.quaternion.multiply(this._preRollDeltaQuat);
		}

		//remote move: lerp toward latest target then feed to constraint solver
		const REMOTE_LERP_FACTOR = 0.2;
		const constraintUpdates = {};
		for (const dicemesh of this.persistentDiceList) {
			const target = dicemesh.userData?.remoteMoveTarget;
			if (!target) continue;
			const lerped = dicemesh.userData.remoteMoveSmoothed
				|| (dicemesh.userData.remoteMoveSmoothed = { x: target.x, z: target.z });
			const dx = target.x - lerped.x;
			const dz = target.z - lerped.z;
			if (Math.abs(dx) < 0.001 && Math.abs(dz) < 0.001) {
				lerped.x = target.x;
				lerped.z = target.z;
			} else {
				lerped.x += dx * REMOTE_LERP_FACTOR;
				lerped.z += dz * REMOTE_LERP_FACTOR;
			}
			constraintUpdates[dicemesh.id] = { x: lerped.x, y: GRAB_LIFT_PERSISTENT, z: lerped.z };
		}
		if (Object.keys(constraintUpdates).length > 0) {
			this.physicsWorker?.exec("updateConstraint", { positions: constraintUpdates });
		}
	}

	//build id->mesh lookup spanning persistent dice and any active/settled ephemerals
	_buildMeshByIdMap() {
		const map = new Map();
		for (const m of this.persistentDiceList) map.set(m.id, m);
		if (this.throwEngine) {
			for (const m of this.throwEngine.diceList) map.set(m.id, m);
			for (const m of this.throwEngine.deadDiceList) map.set(m.id, m);
		}
		return map;
	}

	//throw held persistent dice: combined Roll, one sim, one chat message
	async throwPersistentDice(heldDice, velocity) {
		if (!heldDice || heldDice.length === 0) return;

		//filter out dice that were yielded to another player mid-gesture
		heldDice = heldDice.filter(d => {
			if (d.userData?.yielded) {
				d.userData.yielded = false;
				return false;
			}
			return true;
		});
		if (heldDice.length === 0) return;

		//2. build combined Foundry roll
		//d100 secondaries derive their face from the primary's result, not their own term
		//orphan secondaries (primary not held) fall back to rolling independently
		const heldPrimaryLinkGroups = new Set();
		for (const d of heldDice) {
			if (!d.userData?.linkGroupSecondary && d.userData?.linkGroupId) {
				heldPrimaryLinkGroups.add(d.userData.linkGroupId);
			}
		}

		const primaries = [];
		const secondariesByLinkGroup = new Map();
		for (const d of heldDice) {
			const isLinkedSecondary = d.userData?.linkGroupSecondary
				&& d.userData?.linkGroupId
				&& heldPrimaryLinkGroups.has(d.userData.linkGroupId);
			if (isLinkedSecondary) {
				if (!secondariesByLinkGroup.has(d.userData.linkGroupId))
					secondariesByLinkGroup.set(d.userData.linkGroupId, []);
				secondariesByLinkGroup.get(d.userData.linkGroupId).push(d);
			} else {
				primaries.push(d);
			}
		}

		//one Die term per primary, same order
		const rollFormula = primaries.map(d => `1${d.notation.type}`).join("+");
		let roll;
		try {
			roll = Roll.create(rollFormula);
			await roll.evaluate();
		} catch (err) {
			console.error("[Dice So Nice] Persistent dice RNG evaluation failed:", err);
			return;
		}

		//extract per-primary results
		const perPrimaryResults = [];
		for (const term of roll.dice) {
			for (const r of term.results) perPrimaryResults.push(r.result);
		}
		if (perPrimaryResults.length !== primaries.length) {
			console.warn("[Dice So Nice] Persistent batch roll result count mismatch", {
				expected: primaries.length, got: perPrimaryResults.length, formula: rollFormula
			});
			return;
		}

		const forcedByMesh = new Map();
		for (let i = 0; i < primaries.length; i++) {
			const primary = primaries[i];
			const rawResult = perPrimaryResults[i];
			const faces = parseInt(primary.notation.type.slice(1));
			const places = COMPOUND_DICE[faces];
			if (places && primary.userData?.linkGroupId) {
				const primaryDigit = Math.floor(rawResult / places[0].divisor) % 10;
				forcedByMesh.set(primary, primaryDigit);
				primary.notation.compositeResult = rawResult;
				primary.notation.compositeType = primary.notation.type;

				const secondaries = secondariesByLinkGroup.get(primary.userData.linkGroupId) || [];
				for (const sec of secondaries) {
					const dp = sec.userData?.digitPlace;
					if (dp != null && places[dp]) {
						forcedByMesh.set(sec, Math.floor(rawResult / places[dp].divisor) % 10);
					}
					sec.notation.compositeResult = rawResult;
					sec.notation.compositeType = primary.notation.type;
				}
			} else {
				forcedByMesh.set(primary, rawResult);
			}
		}

		//2c. multiplayer sync: emit throw with forced results
		if (this.onPersistentEvent) {
			const results = [];
			for (const [mesh, forcedResult] of forcedByMesh) {
				results.push({
					persistentId: mesh.userData.persistentId,
					forcedResult
				});
			}
			this.onPersistentEvent("throw", {
				data: {
					persistentIds: heldDice.map(d => d.userData.persistentId),
					velocityPct: {
						x: velocity.x / this.diceScene.display.innerWidth,
						y: velocity.y / this.diceScene.display.innerHeight,
						z: velocity.z || 0
					},
					results,
					rollFormula
				}
			});
		}

		//route to queue (Accumulator) for serialized execution
		if (this.onQueueThrow) {
			return this.onQueueThrow({ heldDice, velocity, forcedByMesh, roll, primaries });
		}

		console.warn("[Dice So Nice] throwPersistentDice: onQueueThrow not wired, throw dropped");
	}

	//replay a persistent throw from another client (no Roll, no chat)
	async replayRemoteThrow(heldDice, velocity, forcedByMesh, sfxList = []) {
		if (!heldDice || heldDice.length === 0) return;

		const throwData = { heldDice, velocity, forcedByMesh, roll: null, primaries: heldDice, sfxList };

		//route to queue for serialized execution
		if (this.onQueueThrow) {
			await this.onQueueThrow(throwData);
			if (this.onRemoteThrowReplayed) {
				const userId = heldDice[0]?.userData?.ownerUserId;
				if (userId) this.onRemoteThrowReplayed(userId);
			}
			return;
		}

		console.warn("[Dice So Nice] replayRemoteThrow: onQueueThrow not wired, throw dropped");
	}

	//build impulse map for a persistent throw (shared velocity, random angular per die)
	buildImpulseMap(heldDice, velocity) {
		const ANGULAR_SPEED_TUMBLE = 50;
		const ANGULAR_SPEED_SPIN = 20;
		const impulses = {};
		for (const d of heldDice) {
			impulses[d.id] = {
				velocity: velocity,
				angularVelocity: {
					x: (Math.random() - 0.5) * ANGULAR_SPEED_TUMBLE,
					y: (Math.random() - 0.5) * ANGULAR_SPEED_TUMBLE,
					z: (Math.random() - 0.5) * ANGULAR_SPEED_SPIN
				}
			};
		}
		return impulses;
	}

	//apply SFX matching to thrown persistent dice
	matchSFX(heldDice, sfxList, roll = null) {
		if (!Array.isArray(sfxList) || sfxList.length === 0) return;

		// handle advanced formula entries
		const advancedEntries = sfxList.filter(sfx => sfx.mode === 'advanced' && sfx.formula);
		if (advancedEntries.length > 0) {
			const contextDice = heldDice.filter(dm => dm.forcedResult != null).map(dm => ({
				type: dm.notation.type,
				result: dm.forcedResult,
				compositeResult: dm.notation.compositeResult || null,
				compositeType: dm.notation.compositeType || null,
				options: dm.options || {},
				termIndex: null,
				termNumber: null,
				termTotal: null,
				termFaces: null,
				termModifiers: null,
				_mesh: dm
			}));
			// build term metadata so aggregate formulas (e.g. 2d6 >= 10) work on persistent dice
			const typeGroups = new Map();
			for (const d of contextDice) {
				const key = d.compositeType || d.type;
				if (!typeGroups.has(key)) typeGroups.set(key, []);
				typeGroups.get(key).push(d);
			}
			let termIdx = 0;
			for (const [typeKey, group] of typeGroups) {
				const faces = parseInt(typeKey.slice(1));
				const primaryDice = group.filter(d => !d.compositeType || d.type === typeKey);
				const logicalCount = primaryDice.length || group.length;
				const total = primaryDice.length > 0
					? primaryDice.reduce((sum, d) => sum + (d.compositeResult ?? d.result), 0)
					: group.reduce((sum, d) => sum + d.result, 0);
				for (const d of group) {
					d.termIndex = termIdx;
					d.termFaces = faces;
					d.termNumber = logicalCount;
					d.termTotal = total;
				}
				termIdx++;
			}
			const rollTotal = roll?.total ?? null;
			for (const sfx of advancedEntries) {
				const matchedCtx = SFXFormulaMatcher.match(sfx.formula, { dice: contextDice, rollTotal });
				const sfxClass = DiceSFXManager.SFX_MODE_CLASS?.[sfx.specialEffect];
				const oncePerMesh = sfxClass?.PLAY_ONLY_ONCE_PER_MESH;
				for (const ctx of matchedCtx) {
					if (oncePerMesh && ctx.compositeType && ctx.type !== ctx.compositeType) continue;
					const dm = ctx._mesh;
					if (!dm.specialEffects) dm.specialEffects = [];
					dm.specialEffects.push({ specialEffect: sfx.specialEffect, options: sfx.options || {} });
				}
			}
		}

		// handle basic entries (existing per-die logic)
		const basicSfxList = sfxList.filter(sfx => !sfx.mode || sfx.mode !== 'advanced');
		for (const dicemesh of heldDice) {
			if (dicemesh.forcedResult == null) continue;
			const matched = this._matchPersistentSFX(
				basicSfxList, dicemesh.notation.type,
				dicemesh.forcedResult, dicemesh.notation.compositeResult || null, dicemesh.notation.compositeType || null
			);
			if (matched.length > 0) {
				if (!dicemesh.specialEffects) dicemesh.specialEffects = [];
				dicemesh.specialEffects.push(...matched);
			}
		}

		// dedup across basic and advanced entries
		for (const dicemesh of heldDice) {
			if (dicemesh.specialEffects) {
				dicemesh.specialEffects = dicemesh.specialEffects.filter(
					(v, i, a) => a.findIndex(x => x.specialEffect === v.specialEffect) === i
				);
			}
		}
	}

	//match SFX config entries against a persistent die's type and result
	_matchPersistentSFX(sfxList, dieType, forcedResult, compositeResult = null, compositeType = null) {
		if (!Array.isArray(sfxList) || sfxList.length === 0) return [];
		const resultStr = String(forcedResult);
		return sfxList.filter(sfx => {
			if (compositeType && sfx.diceType === compositeType) {
				const sfxClass = DiceSFXManager.SFX_MODE_CLASS?.[sfx.specialEffect];
				if (sfxClass?.PLAY_ONLY_ONCE_PER_MESH && dieType !== sfx.diceType) return false;
				return sfx.onResult.includes(String(compositeResult));
			}
			return sfx.diceType === dieType && sfx.onResult.includes(resultStr);
		});
	}

}
