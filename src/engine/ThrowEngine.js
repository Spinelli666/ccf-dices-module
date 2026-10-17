import { DICE_MODELS } from './DiceModels.js';
import { DiceSFXManager } from '../sfx/DiceSFXManager.js';
import { DiceSystem } from '../DiceSystem.js';
import { LEGACY_TO_METERS } from './SceneConstants.js';
import {
	Color,
	Euler,
	Group,
	MathUtils,
	Quaternion
} from 'three';

const SPAWN_HEIGHT_MIN = 200 * LEGACY_TO_METERS;
const SPAWN_HEIGHT_RANGE = 200 * LEGACY_TO_METERS;
const SPAWN_DROP_VELOCITY = -10 * LEGACY_TO_METERS;
const COIN_LIFT_VELOCITY = 3000 * LEGACY_TO_METERS;
const SPAWN_PLANAR_JITTER = 100 * LEGACY_TO_METERS;

//owns throw orchestration: vector computation, physics simulation, face swapping,
//animation buffer replay, ephemeral dice spawning, SFX triggering on throw completion
export class ThrowEngine {

	constructor(diceScene, physicsWorker, diceFactory, soundManager) {
		this.diceScene = diceScene;
		this.physicsWorker = physicsWorker;
		this.dicefactory = diceFactory;
		this.soundManager = soundManager;

		this.diceList = [];
		this.deadDiceList = [];
		this.iteration = 0;
		this.iterationsNeeded = 0;
		this.minIterations = 0;
		this.detectedCollides = [];
		this.framerate = (1 / 60);
		this.speed = 1;
		this.throwingForce = "medium";
		this.nbIterationsBetweenRolls = 15;
		this.rolling = false;
		this.running = false;

		this.throws = null;
		this.callback = null;

		//set by DiceBox to the DiceBox instance - SFX subclasses access box.scene, box.camera, etc.
		this.sfxContext = null;

		//set by DiceBox - reference to PersistentDiceManager for unified batch orchestration
		this.persistentDiceManager = null;

		//set by DiceBox - reference to persistent dice array for simulateThrow
		this.persistentDiceList = [];
	}

	vectorRand({ x, y }) {
		let angle = Math.random() * Math.PI / 5 - Math.PI / 5 / 2;
		let vec = {
			x: x * Math.cos(angle) - y * Math.sin(angle),
			y: x * Math.sin(angle) + y * Math.cos(angle)
		};
		if (vec.x == 0) vec.x = 0.01;
		if (vec.y == 0) vec.y = 0.01;
		return vec;
	}

	getVectors(notationVectors, vector, boost, dist) {

		for (let i = 0; i < notationVectors.dice.length; i++) {

			const diceobj = this.dicefactory.get(notationVectors.dice[i].type);

			let vec = this.vectorRand(vector);

			vec.x /= dist;
			vec.y /= dist;

			let W = this.diceScene.display.innerWidth;
			let H = this.diceScene.display.innerHeight;
			let pos = {
				x: W * (vec.x > 0 ? -1 : 1) * 0.9 + (Math.random() * 2 - 1) * SPAWN_PLANAR_JITTER,
				y: Math.random() * SPAWN_HEIGHT_RANGE + SPAWN_HEIGHT_MIN,
				z: H * (vec.y > 0 ? -1 : 1) * 0.9 + (Math.random() * 2 - 1) * SPAWN_PLANAR_JITTER
			};

			let projector = Math.abs(vec.x / vec.y);
			if (projector > 1.0) pos.z /= projector; else pos.x *= projector;


			let velvec = this.vectorRand(vector);

			velvec.x /= dist;
			velvec.y /= dist;
			let velocity, angle, axis;

			if (diceobj.shape != "d2") {

				velocity = {
					x: velvec.x * boost,
					y: SPAWN_DROP_VELOCITY,
					z: velvec.y * boost
				};

				angle = {
					x: -(Math.random() * vec.y * 5 + diceobj.inertia * vec.y),
					y: 0,
					z: Math.random() * vec.x * 5 + diceobj.inertia * vec.x
				};

				axis = {
					x: 0,
					y: 0,
					z: 0,
					a: 0
				};
			} else {
				//coin flip
				velocity = {
					x: velvec.x * boost / 10,
					y: COIN_LIFT_VELOCITY,
					z: velvec.y * boost / 10
				};

				angle = {
					x: 12 * diceobj.inertia,
					y: 0,
					z: 1 * diceobj.inertia
				};

				axis = {
					x: 1,
					y: Math.random(),
					z: 1,
					a: Math.random()
				};
			}

			notationVectors.dice[i].vectors = {
				type: diceobj.type,
				pos,
				velocity,
				angle,
				axis
			};
		}
		return notationVectors;
	}

	// swaps dice faces to match desired result
	swapDiceFace(dicemesh, faceValue) {
		const diceobj = this.dicefactory.get(dicemesh.notation.type);

		let value = parseInt(faceValue);
		let result = parseInt(dicemesh.forcedResult);

		if (diceobj.shape == 'd10' && result == 0) result = 10;

		if (diceobj.valueMap) { //die with special values
			result = diceobj.valueMap[result];
		}

		if (value == result) return;

		let rotIndex = value > result ? result + "," + value : value + "," + result;
		let rotationDegrees = DICE_MODELS[dicemesh.shape].rotationCombinations[rotIndex];
		if (!rotationDegrees) {
			console.log(`[Dice So Nice] No dice rotation found for ${dicemesh.shape} ${value} ${result}`);
			rotationDegrees = [0, 0, 0];
		}
		let eulerAngle = new Euler(MathUtils.degToRad(rotationDegrees[0]), MathUtils.degToRad(rotationDegrees[1]), MathUtils.degToRad(rotationDegrees[2]));
		let quaternion = new Quaternion().setFromEuler(eulerAngle);
		if (value > result)
			quaternion.invert();

		dicemesh.applyQuaternion(quaternion);
	}

	bakeSwapIntoQuaternionBuffer(stepQuaternions, swapQuat, iterations) {
		const tempQuat = new Quaternion();
		for (let i = 0; i <= iterations; i++) {
			const offset = i * 4;
			tempQuat.set(stepQuaternions[offset], stepQuaternions[offset + 1], stepQuaternions[offset + 2], stepQuaternions[offset + 3]);
			tempQuat.multiply(swapQuat);
			stepQuaternions[offset] = tempQuat.x;
			stepQuaternions[offset + 1] = tempQuat.y;
			stepQuaternions[offset + 2] = tempQuat.z;
			stepQuaternions[offset + 3] = tempQuat.w;
		}
	}

	//create a dice mesh (shared setup for ephemeral and persistent)
	async createDiceMesh(type, appearance, diceLibrary = null, scopedTextureCache = null) {
		const diceobj = this.dicefactory.get(type);
		if (!diceobj) return null;

		let dicemesh = await this.dicefactory.create(scopedTextureCache || this.diceScene.renderer.scopedTextureCache, diceobj.type, appearance, diceLibrary);
		if (!dicemesh) return null;

		let mass = diceobj.mass;
		switch (appearance.material) {
			case "metal":
				mass *= 7;
				break;
			case "wood":
				mass *= 0.65;
				break;
			case "glass":
			case "resin":
			case "frosted":
				mass *= 2;
				break;
			case "stone":
				mass *= 1.5;
				break;
		}

		dicemesh.castShadow = this.dicefactory.shadows;
		dicemesh.receiveShadow = this.dicefactory.shadows;
		dicemesh.userData.system = appearance.system;

		return { dicemesh, diceobj, mass };
	}

	//creates one dicemesh and collects the worker spec for batched physics creation
	async spawnDiceMesh(dicedata, appearance, diceLibrary = null, workerSpecs) {
		let vectordata = dicedata.vectors;
		const result = await this.createDiceMesh(vectordata.type, appearance, diceLibrary);
		if (!result) return;
		const { dicemesh, diceobj, mass } = result;

		//todo these should be moved to .userData. old code
		dicemesh.notation = vectordata;
		dicemesh.result = null;
		dicemesh.forcedResult = dicedata.result;
		dicemesh.startAtIteration = dicedata.startAtIteration;
		dicemesh.stopped = 0;
		dicemesh.specialEffects = dicedata.specialEffects;
		dicemesh.options = dicedata.options;
		//todo

		workerSpecs.push({
			id: dicemesh.id,
			shape: diceobj.shape,
			material: appearance.material,
			vectordata: vectordata,
			mass: mass,
			startAtIteration: dicedata.startAtIteration,
			options: dicedata.options
		});

		if (dicemesh.userData.glowingInDarkness) {
			if (canvas.darknessLevel > 0.5) {
				dicemesh.material.emissiveIntensity = 0.3;
				dicemesh.material.emissive = new Color(0xffffff);
			} else {
				dicemesh.material.emissiveIntensity = 0;
				dicemesh.material.emissive = new Color(0x000000);
			}
		}

		let objectContainer = new Group();
		if(dicemesh.userData.modelScale){
			objectContainer.scale.setScalar(dicemesh.userData.modelScale);
		}
		objectContainer.add(dicemesh);

		this.diceList.push(dicemesh);
	}

	//spawns one dicemesh object from a single vectordata object
	async spawnDice(dicedata, appearance, diceLibrary = null) {
		const workerSpecs = [];
		await this.spawnDiceMesh(dicedata, appearance, diceLibrary, workerSpecs);
		if (workerSpecs.length > 0) {
			await this.physicsWorker.exec('createDiceBatch', workerSpecs);
		}
	}

	throwFinished() {
		let stopped = true;
		if (this.iteration <= this.minIterations) return false;
		stopped = this.iteration >= this.iterationsNeeded;
		if (stopped && this.rolling) {
			//Can't await here because of the PIXI ticker. Hopefully it's not needed.
			for (let i = 0, len = this.diceList.length; i < len; ++i) {
				if (!this.diceList[i].sim)
					continue;
				this.diceList[i].sim.stepPositions = new Float32Array(1001 * 3);
				this.diceList[i].sim.stepQuaternions = new Float32Array(1001 * 4);
				if (this.diceList[i].dead > 0)
					this.diceList[i].static = true;
			}
		}
		return stopped;
	}

	addDiceToScene() {
		for (let i = 0; i < this.diceList.length; i++) {
			if (this.diceList[i].startAtIteration == this.iteration) {
				let dicemesh = this.diceList[i];
				//set initial position from sim to avoid flash at origin
				if (dicemesh.sim && dicemesh.sim.stepPositions) {
					dicemesh.parent.position.fromArray(dicemesh.sim.stepPositions, 0);
					dicemesh.parent.quaternion.fromArray(dicemesh.sim.stepQuaternions, 0);
				}
				this.diceScene.scene.add(dicemesh.parent);
				this.dicefactory.systems.get(dicemesh.userData.system).fire(DiceSystem.DICE_EVENT_TYPE.SPAWN, { dice: dicemesh });
			}
		}
	}

	//per-frame: advance iteration, replay buffer positions/quaternions, play collision sounds
	updateThrowPlayback(neededSteps) {
		for (let i = 0; i < neededSteps * this.speed; i++) {
			++this.iteration;
			if (!(this.iteration % this.nbIterationsBetweenRolls)) {
				this.addDiceToScene();
			}
		}
		if (this.iteration > this.iterationsNeeded)
			this.iteration = this.iterationsNeeded;

		for (const child of this.diceScene.scene.children) {
			let dicemesh = child.children && child.children.length && child.children[0].sim != undefined && (!child.children[0].sim.dead || child.children[0].sim.dead > this.iteration) ? child.children[0] : null;

			if (dicemesh && dicemesh.userData?.constrained) continue;

			if (dicemesh && dicemesh.sim.stepPositions[this.iteration * 3]) {
				child.position.fromArray(dicemesh.sim.stepPositions, this.iteration * 3);
				child.quaternion.fromArray(dicemesh.sim.stepQuaternions, this.iteration * 4);
			}
		}

		//Note: if the game is lagging, it means some collisions won't be played. Not sure if it is what we want or not
		if (this.detectedCollides[this.iteration]) {
			this.soundManager.playAudioSprite(...this.detectedCollides[this.iteration]);
		}
	}

	clearDice() {
		this.running = false;
		this.deadDiceList = this.deadDiceList.concat(this.diceList);
		this.diceList = [];
	}

	async clearAll() {
		this.clearDice();
		const diceToRemove = [];
		let dice;
		while (dice = this.deadDiceList.pop()) {
			this.diceScene.scene.remove(dice.parent.type == "Scene" ? dice : dice.parent);
			diceToRemove.push(dice.id);
		}

		if (this.physicsWorker)
			await this.physicsWorker.exec("removeDice", diceToRemove);
	}

	//unified batch: handles any mix of ephemeral throws and persistent dice in one sim
	async startUnifiedBatch(throws, persistentThrowData, callback) {
		if (this.rolling) return;

		this.throws = null;
		this.callback = null;
		this.clearDice();

		// === EPHEMERAL PREPARE ===

		let countNewDice = 0;
		if (throws && throws.length > 0) {
			for (const notation of throws) {
				let vector = {
					x: (Math.random() * 2 - 0.5) * this.diceScene.display.innerWidth,
					y: -(Math.random() * 2 - 0.5) * this.diceScene.display.innerHeight
				};
				let dist = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
				let throwingForceModifier = 0.8;
				switch (this.throwingForce) {
					case "weak": throwingForceModifier = 0.5; break;
					case "strong": throwingForceModifier = 1.8; break;
				}
				let boost = ((Math.random() + 3) * throwingForceModifier) * dist;
				this.getVectors(notation, vector, boost, dist);
				countNewDice += notation.dice.length;
			}

			let maxDiceNumber = game.settings.get("dice-so-nice", "maxDiceNumber");
			if (this.deadDiceList.length + this.diceList.length + countNewDice > maxDiceNumber) {
				if (this.onClearAll) await this.onClearAll();
			}

			const workerSpecs = [];
			let spawned = 0;
			let lastGroup = 0;
			for (let j = 0; j < throws.length && spawned < maxDiceNumber; j++) {
				let notationVectors = throws[j];
				for (let i = 0, len = notationVectors.dice.length; i < len && spawned < maxDiceNumber; ++i) {
					notationVectors.dice[i].startAtIteration = j * this.nbIterationsBetweenRolls;
					let appearance = this.dicefactory.getAppearanceForDice(notationVectors.dsnConfig.appearance, notationVectors.dice[i].type, notationVectors.dice[i]);
					await this.spawnDiceMesh(notationVectors.dice[i], appearance, notationVectors.dsnConfig.diceLibrary, workerSpecs);
					spawned++;
					lastGroup = j;
				}
			}
			//base the stagger floor on groups that actually spawned, so dropped tail groups don't reserve dead iterations
			this.minIterations = lastGroup * this.nbIterationsBetweenRolls;
			if (workerSpecs.length > 0) {
				await this.physicsWorker.exec('createDiceBatch', workerSpecs);
			}
		} else {
			this.minIterations = 0;
		}

		// === PERSISTENT PREPARE ===

		let impulses = null;
		const thrownPersistentIds = new Set();
		if (persistentThrowData) {
			const { heldDice, velocity } = persistentThrowData;
			for (const d of heldDice) thrownPersistentIds.add(d.id);

			impulses = this.persistentDiceManager.buildImpulseMap(heldDice, velocity);

			const bodyUpdates = [];
			for (const d of heldDice) {
				if (d.parent) {
					bodyUpdates.push({ id: d.id, position: { x: d.parent.position.x, y: d.parent.position.y, z: d.parent.position.z } });
				}
			}
			if (bodyUpdates.length > 0) {
				await this.physicsWorker.exec("setBodyPositions", { updates: bodyUpdates });
			}

			for (const d of heldDice) d.quaternion.set(0, 0, 0, 1);
		}

		// ghostify constrained persistent dice not being thrown
		const ghostifiedIds = [];
		for (const die of this.persistentDiceList) {
			if (die.userData?.constrained && !thrownPersistentIds.has(die.id)) {
				ghostifiedIds.push(die.id);
			}
		}
		if (ghostifiedIds.length > 0) {
			await this.physicsWorker.exec("setCollisionResponse", { ids: ghostifiedIds, enabled: false });
		}
		this._ghostifiedIds = ghostifiedIds;

		// === SIMULATE (one unified worker call) ===

		this.rolling = true;

		const simResult = await this.physicsWorker.exec('simulateThrow', {
			minIterations: this.minIterations,
			nbIterationsBetweenRolls: this.nbIterationsBetweenRolls,
			framerate: this.framerate,
			canBeFlipped: game.settings.get("dice-so-nice", "diceCanBeFlipped"),
			impulses: impulses
		});

		if (!simResult) {
			console.error("[Dice So Nice] startUnifiedBatch: simulateThrow returned no result");
			this.rolling = false;
			if (ghostifiedIds.length > 0) {
				await this.physicsWorker.exec("setCollisionResponse", { ids: ghostifiedIds, enabled: true });
			}
			callback?.(throws);
			return;
		}

		const { ids, quaternionsBuffers, positionsBuffers, detectedCollides, deads, iterationsNeeded, faceValues, finalQuaternions } = simResult;
		const quaternions = quaternionsBuffers.map(buffer => new Float32Array(buffer));
		const positions = positionsBuffers.map(buffer => new Float32Array(buffer));

		this.iterationsNeeded = iterationsNeeded;

		const idToIndex = new Map();
		ids.forEach((id, index) => idToIndex.set(id, index));

		// === POST-SIM: EPHEMERAL DICE ===

		const consumedSimIndices = new Set();
		const ephemeralDiceList = [...this.diceList, ...this.deadDiceList];

		for (const dice of ephemeralDiceList) {
			const index = idToIndex.get(dice.id);
			if (index !== undefined) {
				dice.sim = {
					dead: deads[index],
					stepQuaternions: quaternions[index],
					stepPositions: positions[index]
				};
				consumedSimIndices.add(index);
			} else if (dice.sim) {
				// not tracked in this sim: zero stale buffers so old collisions don't replay
				dice.sim.stepPositions = new Float32Array(1001 * 3);
				dice.sim.stepQuaternions = new Float32Array(1001 * 4);
			}
		}

		for (const dicemesh of this.diceList) {
			if (!dicemesh) continue;
			this.swapDiceFace(dicemesh, faceValues[dicemesh.id]);
		}

		this.diceScene.animatedDiceDetected = await this.checkForAnimatedDice();

		for (const dicemesh of this.diceList) {
			if (dicemesh) dicemesh.result = null;
		}

		// === POST-SIM: PERSISTENT THROWN DICE ===

		if (persistentThrowData) {
			const { heldDice, forcedByMesh, roll, primaries, sfxList: externalSfxList } = persistentThrowData;

			const typeLabels = primaries
				? Array.from(new Set(primaries.map(d => d.notation.type.toUpperCase()))).join(", ")
				: "";

			let chatCarrierAssigned = false;
			for (const dicemesh of heldDice) {
				const diceobj = this.dicefactory.get(dicemesh.notation.type);
				if (!diceobj) continue;

				if (!forcedByMesh.has(dicemesh)) {
					console.warn("[Dice So Nice] Held die has no derived face value - skipping", { id: dicemesh.id });
					continue;
				}

				const simIdx = idToIndex.get(dicemesh.id);
				if (simIdx === undefined) {
					console.warn("[Dice So Nice] Thrown die not found in sim payload", { id: dicemesh.id });
					continue;
				}
				consumedSimIndices.add(simIdx);

				const stepPositions = positions[simIdx];
				const stepQuaternions = quaternions[simIdx];

				const rawFinalQuat = finalQuaternions[dicemesh.id];

				dicemesh.quaternion.set(0, 0, 0, 1);
				dicemesh.forcedResult = forcedByMesh.get(dicemesh);
				this.swapDiceFace(dicemesh, faceValues[dicemesh.id]);

				const swapQuat = dicemesh.quaternion.clone();
				this.bakeSwapIntoQuaternionBuffer(stepQuaternions, swapQuat, iterationsNeeded);

				dicemesh.quaternion.set(0, 0, 0, 1);
				dicemesh.sim = {
					dead: false,
					stepQuaternions: stepQuaternions,
					stepPositions: stepPositions
				};

				const isChatCarrier = !chatCarrierAssigned;
				dicemesh.persistentThrow = {
					swapQuat: swapQuat.clone(),
					rawQuat: rawFinalQuat,
					roll: isChatCarrier ? roll : null,
					diceType: isChatCarrier ? typeLabels : null,
					ghostifiedIds: isChatCarrier ? ghostifiedIds : null
				};
				delete dicemesh.userData.pendingReplay;
				if (isChatCarrier) chatCarrierAssigned = true;
			}

			if (!chatCarrierAssigned && heldDice.length > 0) {
				console.warn("[Dice So Nice] Persistent batch throw produced no chat carrier");
			}

			const pdm = this.persistentDiceManager;
			if (pdm) {
				const sfxList = externalSfxList || (pdm.sfxListForUser ? pdm.sfxListForUser(game.user) : []);
				pdm.matchSFX(heldDice, sfxList, roll);
			}

		}

		// === POST-SIM: PERSISTENT BYSTANDERS ===
		// struck bystanders replay via updateThrowPlayback (runs for all throws, not just persistent)
		const pdmBystander = this.persistentDiceManager;
		if (pdmBystander) {
			const meshById = pdmBystander._buildMeshByIdMap();
			for (let i = 0; i < ids.length; i++) {
				if (consumedSimIndices.has(i)) continue;
				const struckMesh = meshById.get(ids[i]);
				if (!struckMesh || struckMesh.userData?.constrained) continue;
				struckMesh.sim = {
					dead: struckMesh.sim?.dead ?? false,
					stepPositions: positions[i],
					stepQuaternions: quaternions[i]
				};
			}
		}

		// === PLAYBACK SETUP ===

		this.detectedCollides = this.soundManager.generateCollisionSounds(detectedCollides);
		this.iteration = 0;
		this.rolling = true;
		this.running = (new Date()).getTime();
		this.callback = callback;
		this.throws = throws;
	}

	//Check if there's an animated dice to reduce render loop complexity if there's none
	async checkForAnimatedDice() {
		let animatedDiceDetected = false;
		for (const list of [this.diceList, this.persistentDiceList]) {
			for (let i = 0, len = list.length; i < len; ++i) {
				let dicemesh = list[i];
				if (!dicemesh) continue;
				dicemesh.traverse(obj => {
					if(obj.mixer || obj.material?.mixer){
						animatedDiceDetected = true;
					}
				});
			}
		}

		return animatedDiceDetected;
	}

	fireResultEvents() {
		for (let i = 0; i < this.diceList.length; i++) {
			this.dicefactory.systems.get(this.diceList[i].userData.system).fire(DiceSystem.DICE_EVENT_TYPE.RESULT, { dice: this.diceList[i] });
		}
	}

	async handlePersistentThrowCompletion() {
		const promises = [];
		for (const dicemesh of this.persistentDiceList) {
			const pt = dicemesh.persistentThrow;
			if (!pt) continue;

			if (dicemesh.sim && dicemesh.parent) {
				const fi = this.iterationsNeeded;
				dicemesh.parent.position.fromArray(dicemesh.sim.stepPositions, fi * 3);
				if (pt.rawQuat) {
					const rq = pt.rawQuat;
					dicemesh.parent.quaternion.set(rq.x, rq.y, rq.z, rq.w);
				} else {
					dicemesh.parent.quaternion.fromArray(dicemesh.sim.stepQuaternions, fi * 4);
				}
			}
			if (pt.swapQuat) {
				dicemesh.quaternion.copy(pt.swapQuat);
			}

			if (pt.roll) {
				promises.push(
					pt.roll.toMessage({
						flavor: `${pt.diceType} - Persistent Dice`,
						flags: { "dice-so-nice": { persistent: true } }
					}).catch(err => {
						console.error("[Dice So Nice] Failed to create persistent dice chat message:", err);
						if (ui?.notifications) ui.notifications.warn("Dice So Nice: persistent roll failed to post to chat (see console).");
					})
				);
			}

			if (dicemesh.specialEffects) {
				for (const sfx of dicemesh.specialEffects) {
					promises.push(DiceSFXManager.playSFX(sfx, this.sfxContext, dicemesh));
				}
				delete dicemesh.specialEffects;
			}

			delete dicemesh.sim;
			delete dicemesh.persistentThrow;
		}
		return Promise.all(promises);
	}

	async handleSpecialEffectsInit() {
		let promisesSFX = [];
		this.diceList.forEach(dice => {
			if (dice.specialEffects) {
				dice.specialEffects.forEach(sfx => {
					promisesSFX.push(DiceSFXManager.playSFX(sfx, this.sfxContext, dice));
				});
			}
		});
		return Promise.all(promisesSFX);
	}
}
