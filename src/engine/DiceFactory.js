// Modified by ccf-web (2026-10-12, 2026-10-16) from Dice So Nice 6.2.9 (AGPL-3.0): asset URLs made absolute (/modules/dice-so-nice/...); physics worker loaded with new Worker(new URL(...)) instead of rollup's web-worker: import, from the built PhysicsWorker.js next to the bundle.
export const AMBIANCE_LIST = {
	"foyer_1k": "DICESONICE.AmbianceNeutral",
	"warm_restaurant_night_1k": "DICESONICE.AmbianceTavern",
	"shanghai_bund_1k": "DICESONICE.AmbianceNeon"
};

import {DicePreset, D4_TRIPLET_VALUES} from './DicePreset.js';
import {BASE_PRESETS_LIST, EXTRA_PRESETS_LIST} from './DiceDefaultPresets.js';
import {DiceColors, DICE_SCALE, COLORSETS} from './DiceColors.js';
import {DICE_MODELS, DICE_SHAPE} from './DiceModels.js';
import {DiceSystem} from '../DiceSystem.js';
import {DiceLibrary} from './DiceLibrary.js';
import {TARGET_D6_EDGE_METERS} from './SceneConstants.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { ShaderUtils } from './ShaderUtils';
function PhysicsWorker() {
	return new Worker(new URL('./PhysicsWorker.js', import.meta.url), { type: 'module' });
}
import WebworkerPromise from 'webworker-promise';

import {
	MixOperation,
	AddOperation,
	AnimationMixer,
	Mesh,
	Color,
	Vector2,
	MeshPhongMaterial,
	MeshStandardMaterial,
	MeshLambertMaterial,
	MeshPhysicalMaterial,
	CanvasTexture,
	SRGBColorSpace,
	DoubleSide,
	BufferGeometryLoader
} from 'three';

export class DiceFactory {

	constructor() {
		this.geometries = {};

		this._physicsWorker = null;
		this._loaderGLTF = null;

		this.baseScale = TARGET_D6_EDGE_METERS;
		this.showcaseScale = TARGET_D6_EDGE_METERS * 1.2;

		this.preferredSystem = "standard";
		this.preferredColorset = "custom";

		this.cache_hits = 0;
		this.cache_misses = 0;

		this.realisticLighting = true;
		this.normalMapStrength = 1.5;
		this.advancedGlass = false;

		this.fontLoadingPromises = [];

		this.baseMaterialCache = {};

		this.systems = new Map();
		this.damageTypeDefaults = new Map();
		this.systems.set("standard", new DiceSystem("standard", game.i18n.localize("DICESONICE.System.Standard"), "default"));
		this.systems.set("spectrum", new DiceSystem("spectrum", game.i18n.localize("DICESONICE.System.SpectrumDice"), "default", "Dice So Nice!"));
		this.systems.set("foundry_vtt", new DiceSystem("foundry_vtt", game.i18n.localize("DICESONICE.System.FoundryVTT"), "default", "Dice So Nice!"));
		this.systems.set("dot", new DiceSystem("dot", game.i18n.localize("DICESONICE.System.Dot"), "default", "Dice So Nice!"));
		this.systems.set("dot_b", new DiceSystem("dot_b", game.i18n.localize("DICESONICE.System.DotBlack"), "default", "Dice So Nice!"));

		//load all the systems
		for(let [id, system] of this.systems){
			system.loadSettings();
		}
		
		BASE_PRESETS_LIST.forEach((preset) => {
			this.register(preset);
		});
		
		EXTRA_PRESETS_LIST.forEach((data) => {
			this.addDicePreset(data);
		});

		for(let i in CONFIG.Dice.terms){
			let term = CONFIG.Dice.terms[i];
			if([foundry.dice.terms.Coin, foundry.dice.terms.FateDie, foundry.dice.terms.Die].includes(term)) continue;
			// skip Die subclasses that keep the default "d" denomination (e.g. dnd5e BasicDie)
			// but allow subclasses with a custom denomination (e.g. w40k WrathDie "w")
			if(term.prototype instanceof foundry.dice.terms.Die && term.DENOMINATION === foundry.dice.terms.Die.DENOMINATION) continue;
			if(term._dsnCustomTerm) continue;
			let objTerm = new term({});
			if([2, 3, 4, 6, 8, 10, 12, 14, 16, 20, 24, 30].includes(objTerm.faces)){
				this.internalAddDicePreset(objTerm);
			}
		}

		//build material_options up front so consumers like sanitizeAppearance
		//can read it before the first scene init re-runs this with quality settings.
		this.initializeMaterials();
	}

	get physicsWorker() {
		if (!this._physicsWorker) {
			this._physicsWorker = new WebworkerPromise(new PhysicsWorker());
		}
		return this._physicsWorker;
	}

	get loaderGLTF() {
		if (!this._loaderGLTF) {
			this._loaderGLTF = new GLTFLoader();
			const draco = new DRACOLoader();
			draco.setDecoderPath('/modules/dice-so-nice/libs/');
			draco.setDecoderConfig({type: 'wasm'});
			this._loaderGLTF.setDRACOLoader(draco);
		}
		return this._loaderGLTF;
	}

	initializeMaterials(){
		if(this.realisticLighting){
			this.material_options = {
				'plastic': {
					'type':"standard",
					'options':{
						metalness: 1
					},
					'scopedOptions':{
						roughnessMap : "roughnessMap_plastic",
						metalnessMap : "roughnessMap_plastic",
						envMap : true
					}
				},
				'metal': {
					'type':'standard',
					'options': {
						metalness: 1
					},
					'scopedOptions':{
						roughnessMap : "roughnessMap_metal",
						metalnessMap : "roughnessMap_metal",
						normalMap : "normalMap_metal",
						detailNormalScale : 1.0,
						envMap : true
					}
				},
				'wood': {
					'type':'standard',
					'options': {
						metalness: 1
					},
					'scopedOptions':{
						roughnessMap : "roughnessMap_wood",
						metalnessMap : "roughnessMap_wood",
						normalMap : "normalMap_wood",
						detailNormalScale : 1.0,
						envMap : true
					}
				},
				'glass': this.advancedGlass ? {
					'type':'physical',
					'options': {
						metalness: 1,
						transmission: 1.0,
						ior: 1.49,
						thickness: TARGET_D6_EDGE_METERS * 1.2,
						attenuationDistance: TARGET_D6_EDGE_METERS * 1.2,
						attenuationColor: new Color(0.95, 0.95, 1.0),
						side: DoubleSide
					},
					'scopedOptions':{
						roughnessMap : "roughnessMap_glass",
						metalnessMap : "roughnessMap_glass",
						envMap : true
					},
					'usesTransmissionMask': true
				} : {
					'type':'standard',
					'options': {
						metalness: 1
					},
					'scopedOptions':{
						roughnessMap : "roughnessMap_glass",
						metalnessMap : "roughnessMap_glass",
						envMap : true
					}
				},
				'resin': this.advancedGlass ? {
					'type':'physical',
					'options': {
						metalness: 1,
						roughness: 0.4,
						transmission: 1.0,
						ior: 1.49,
						thickness: TARGET_D6_EDGE_METERS * 1.2,
						attenuationDistance: TARGET_D6_EDGE_METERS * 1.2,
						attenuationColor: new Color(0.95, 0.95, 1.0),
						side: DoubleSide
					},
					'scopedOptions':{
						roughnessMap : "roughnessMap_resin",
						metalnessMap : "roughnessMap_resin",
						envMap : true
					},
					'usesTransmissionMask': true
				} : {
					'type':'standard',
					'options': {
						metalness: 1
					},
					'scopedOptions':{
						roughnessMap : "roughnessMap_resin",
						metalnessMap : "roughnessMap_resin",
						envMap : true
					}
				},
				'frosted': this.advancedGlass ? {
					'type':'physical',
					'options': {
						metalness: 1,
						roughness: 0.3,
						transmission: 1.0,
						ior: 1.49,
						thickness: TARGET_D6_EDGE_METERS * 1.2,
						attenuationDistance: TARGET_D6_EDGE_METERS * 1.2,
						attenuationColor: new Color(0.95, 0.95, 1.0),
						side: DoubleSide
					},
					'scopedOptions':{
						roughnessMap : "roughnessMap_frosted",
						metalnessMap : "roughnessMap_frosted",
						envMap : true
					},
					'usesTransmissionMask': true
				} : {
					'type':'standard',
					'options': {
						metalness: 1
					},
					'scopedOptions':{
						roughnessMap : "roughnessMap_frosted",
						metalnessMap : "roughnessMap_frosted",
						envMap : true
					}
				},
				'chrome': {
					'type':'standard',
					'options': {
						metalness: 1
					},
					'scopedOptions':{
						roughnessMap : "roughnessMap_chrome",
						metalnessMap : "roughnessMap_chrome",
						envMap : true
					}
				},
				'pristine': {
					'type':'physical',
					'options': {
						metalness: 0,
						roughness: 0.8,
						clearcoat: 1,
						clearcoatRoughness: 0.1
					},
					'scopedOptions':{
						envMap : true
					}
				},
				'iridescent': {
					'type':'physical',
					'options': {
						metalness: 1,
						iridescence: 1,
						iridescenceIOR: 1.8,
						iridescenceThicknessRange: [300,700]
					},
					'scopedOptions':{
						roughnessMap : "roughnessMap_iridescent",
						metalnessMap : "roughnessMap_iridescent",
						envMap : true
					}
				},
				'stone': {
					'type':'standard',
					'options': {
						metalness: 1
					},
					'scopedOptions':{
						roughnessMap : "roughnessMap_stone",
						metalnessMap : "roughnessMap_stone",
						normalMap : "normalMap_stone",
						detailNormalScale : 1.0,
						envMap : true
					}
				},
				'velvet': {
					'type':'physical',
					'options': {
						metalness: 1,
						sheen: 0.5,
						sheenRoughness: 0.8,
						sheenColor: new Color(0.8, 0.8, 0.8)
					},
					'scopedOptions':{
						roughnessMap : "roughnessMap_velvet",
						metalnessMap : "roughnessMap_velvet",
						normalMap : "normalMap_velvet",
						detailNormalScale : 1.0,
						envMap : true
					}
				}
			}
		} else {
			this.material_options = {
				'plastic': {
					'type':"phong",
					'options':{
						specular: 0xffffff,
						color: 0xb5b5b5,
						shininess: 3,
						flatShading: true
					}
				},
				'metal': {
					'type':'standard',
					'options': {
						color: 0xdddddd,
						emissive:0x111111,
						roughness: 0.6,
						metalness: 1,
						envMapIntensity:2
					},
					'scopedOptions':{
						envMap:true
					}
				},
				'wood': {
					'type':'phong',
					'options': {
						specular: 0xffffff,
						color: 0xb5b5b5,
						shininess: 1,
						flatShading: true
					}
				},
				'glass': {
					'type':'phong',
					'options': {
						specular: 0xffffff,
						color: 0xb5b5b5,
						shininess: 0.3,
						reflectivity:0.1,
						combine:MixOperation
					},
					'scopedOptions':{
						envMap:true
					}
				},
				'resin': {
					'type':'phong',
					'options': {
						specular: 0xffffff,
						color: 0xb5b5b5,
						shininess: 0.3,
						reflectivity:0.1,
						combine:MixOperation
					},
					'scopedOptions':{
						envMap:true
					}
				},
				'frosted': {
					'type':'phong',
					'options': {
						specular: 0xffffff,
						color: 0xb5b5b5,
						shininess: 0.3,
						reflectivity:0.1,
						combine:MixOperation
					},
					'scopedOptions':{
						envMap:true
					}
				},
				'chrome': {
					'type':'phong',
					'options': {
						specular: 0xffffff,
						color: 0xb5b5b5,
						shininess: 1,
						reflectivity:0.7,
						combine:AddOperation
					},
					'scopedOptions':{
						envMap:true
					}
				},
				//no difference with plastic without advanced ligthing
				'pristine': {
					'type':'phong',
					'options':{
						specular: 0xffffff,
						color: 0xb5b5b5,
						shininess: 3,
						flatShading: true
					}
				},
				//not possible without advanced ligthing
				'iridescent': {
					'type':'standard',
					'options': {
						color: 0xdddddd,
						emissive:0x111111,
						roughness: 0.2,
						metalness: 1,
						envMapIntensity:2
					},
					'scopedOptions':{
						envMap:true
					}
				},
				'stone': {
					'type':'lambert',
					'options': {
						color: 0xb5b5b5,
						reflectivity:0.01
					},
					'scopedOptions':{
						envMap:true
					}
				},
				'velvet': {
					'type':'phong',
					'options':{
						specular: 0xffffff,
						color: 0xb5b5b5,
						shininess: 1,
						flatShading: true
					}
				}
			}
		}
	}

	setScale(scale){
		this.baseScale = scale;
	}

	setQualitySettings(config){
		this.realisticLighting = config.bumpMapping;
		this.aa = config.antialiasing;
		this.glow = config.glow;
		this.useHighDPI = config.useHighDPI;
		this.shadows = config.shadowQuality != "none";
		this.shadowQuality = config.shadowQuality;
		this.advancedGlass = !!config.advancedGlass;
		this.ambiance = config.ambiance in AMBIANCE_LIST ? config.ambiance : "foyer_1k";
	}

	register(diceobj) {
		//If it is added to standard, it can be from automated system detecting DiceTerm, or the basic dice list. In those case, the internalAdd preorperty is set to true
		//Everything should exist in the standard system
		//We check to see if there's already this Dice DONOMINATOR in the standard system
		const hasDice = this.systems.get("standard").dice.has(diceobj.type);

		//If it exists in the standard system, and it was added there by the automated system, we want to override and load it
		if(hasDice && (this.systems.get("standard").dice.get(diceobj.type).internalAdd || diceobj.internalAdd)){
			this.systems.get("standard").dice.set(diceobj.type, diceobj);
			if(diceobj.modelFile){
				diceobj.loadModel(this.loaderGLTF);
			} else {
				diceobj.loadTextures();
			}
		}
		if(diceobj.system == "standard"){
			//If we're adding to the standard system directly, we only do it if it didn't exist previously
			if(!hasDice){
				this.systems.get(diceobj.system).dice.set(diceobj.type, diceobj);
			}	
		} else {
			//If for some reasons, we try to register a dice type that doesnt exist on the standard system, we add it there first.
			//This should not happen because of internalAddDicePreset but I'm only 95% sure.
			if(!hasDice){
				this.systems.get("standard").dice.set(diceobj.type, diceobj);
				if(diceobj.modelFile){
					diceobj.loadModel(this.loaderGLTF);
				} else {
					diceobj.loadTextures();
				}
			}
			//Then we add it to its own system. No need to load it, that will be taken care of automatically
			this.systems.get(diceobj.system).dice.set(diceobj.type, diceobj);
		}
	}

	async preloadPresets(waitForLoad = true, userID = null, config = {}, documentUuid = null){
		let activePresets = [];
		const preloadPresetsByUser = (user) => {
			let appearance = user.getFlag("dice-so-nice", "appearance") ? foundry.utils.duplicate(user.getFlag("dice-so-nice", "appearance")) : null;
			if(!appearance){
				appearance = {global:{}};
				if(this.preferredSystem != "standard")
					appearance.global.system = this.preferredSystem;
				if(this.preferredColorset != "custom")
					appearance.global.colorset = this.preferredColorset;
			}
			//load basic model
			this.systems.get("standard").dice.forEach((obj) =>{
				activePresets.push(obj);
			});
			foundry.utils.mergeObject(appearance, config,{applyOperators:true});
			if(!foundry.utils.isEmpty(appearance)){
				for (let scope in appearance) {
					if (appearance.hasOwnProperty(scope)) {
						if(scope != "global")
							activePresets.push(this.getPresetBySystem(scope, appearance[scope].system));
						else if(this.systems.has(appearance[scope].system)){
							this.systems.get(appearance[scope].system).dice.forEach((obj) =>{
								activePresets.push(obj);
							});
						}
					}
				}
			}
		};

		const preloadPresetsForDocument = (doc) => {
			let appearance = doc.getFlag("dice-so-nice", "appearance");
			if (!appearance || foundry.utils.isEmpty(appearance)) return;
			appearance = foundry.utils.duplicate(appearance);
			for (let scope in appearance) {
				if (!appearance.hasOwnProperty(scope)) continue;
				if (scope != "global")
					activePresets.push(this.getPresetBySystem(scope, appearance[scope].system));
				else if (appearance[scope].system && this.systems.has(appearance[scope].system)) {
					this.systems.get(appearance[scope].system).dice.forEach((obj) => {
						activePresets.push(obj);
					});
				}
			}
		};

		if (documentUuid) {
			const doc = foundry.utils.fromUuidSync(documentUuid);
			if (doc) preloadPresetsForDocument(doc);
		} else if(userID) {
			preloadPresetsByUser(game.users.get(userID));
		} else {
        	game.users.forEach((user) =>{
				preloadPresetsByUser(user);
			});
		}
        //remove duplicate
        activePresets = activePresets.filter((v, i, a) => a.indexOf(v) === i);
		let promiseArray = [];
		activePresets.forEach((preset)=>{
			if(preset){
				if(preset.modelFile){
					//Custom 3D model
					promiseArray.push(preset.loadModel(this.loaderGLTF));
				} else {
					//Classic 3D model
					promiseArray.push(preset.loadTextures());
				}
			}
		});

		if(waitForLoad)
			await Promise.all(promiseArray);
	}

	//force-load every preset registered under a system id.
	//used by the public preloadPresets API so modules/systems that register
	//internal presets (not selected in any user appearance) don't pay for
	//texture/model loading on the first roll.
	async forceLoadPresets(systemId){
		if(!this.systems.has(systemId)){
			console.warn(`Dice So Nice | preloadPresets: unknown system "${systemId}"`);
			return;
		}
		const system = this.systems.get(systemId);
		const promises = [];
		system.dice.forEach((preset) => {
			if(!preset) return;
			if(preset.modelFile)
				promises.push(preset.loadModel(this.loaderGLTF));
			else
				promises.push(preset.loadTextures());
		});
		await Promise.all(promises);
	}

	//{id: 'standard', name: game.i18n.localize("DICESONICE.System.Standard")}
	//Internal use, legacy
	//See dice3d.addDamageTypeDefaults for public API
	addDamageTypeDefaults(mapping){
		if(!mapping || typeof mapping !== "object") return;
		for(const [id, def] of Object.entries(mapping)){
			const colorset = def?.colorset ?? null;
			const preset = def?.preset ?? null;
			const label = def?.label ?? null;
			if(colorset && !COLORSETS[colorset])
				console.warn(`Dice So Nice! | addDamageTypeDefaults: damage type "${id}" references unknown colorset "${colorset}"`);
			if(preset && !this.systems.has(preset))
				console.warn(`Dice So Nice! | addDamageTypeDefaults: damage type "${id}" references unknown preset "${preset}"`);
			this.damageTypeDefaults.set(id, { colorset, preset, label });
		}
	}

	getEffectiveDamageTypeDefault(id){
		const dev = this.damageTypeDefaults.get(id);
		if(dev)
			return { preset: dev.preset || "standard", colorset: dev.colorset || "" };
		return { preset: "standard", colorset: "" };
	}

	//See dice3d.addSystem for public API
	addSystem(system, mode="default"){
		if(system.constructor.name === 'DiceSystem'){ //note: do not use instanceof, it breaks on The Forge
			this.systems.set(system.id, system);
			mode = system.mode;
		} else {
			system = new DiceSystem(system.id, system.name, mode, system.group);
			this.systems.set(system.id, system);
			
		}
		system.loadSettings();
		if(mode != "default" && this.preferredSystem == "standard")
			this.preferredSystem = system.id;
	}

	//{type:"",labels:[],system:""}
	//Should have been called "addDicePresetFromModel" but ¯\_(ツ)_/¯
	addDicePreset(dice, shape = null){
		let model = this.systems.get("standard").dice.get(dice.type);
		if(!model || !model.internalAdd){
			if(!shape)
				shape = dice.type;
			model = this.systems.get("standard").dice.get(shape);
		}
		let preset = new DicePreset(dice.type, model.shape);
		let denominator = dice.type.substring(1,dice.type.length);

		preset.term = isNaN(denominator) ? CONFIG.Dice.terms[denominator].name : "Die";
		
		preset.setLabels(dice.labels);
		preset.setModel(dice.modelFile);
		if(dice.values){
			if(dice.values.min == undefined)
				dice.values.min = 1;
			if(dice.values.max == undefined)
				dice.values.max = model.values.length;
			if(dice.values.step == undefined)
				dice.values.step = 1;
			preset.setValues(dice.values.min,dice.values.max,dice.values.step);
		} else {
			preset.values = model.values;
			preset.valueMap = model.valueMap;
		}
		if(dice.valueMap){
			preset.valueMap = dice.valueMap;
		}
		preset.mass = model.mass;
		preset.scaleModifier = dice.scaleModifier ?? 1;
		preset.scale = model.scale * preset.scaleModifier;
		preset.inertia = model.inertia;
		preset.system = dice.system;
		preset.font = dice.font;
		preset.fontScale = dice.fontScale || null;
		preset.colorset = dice.colorset || null;
		//If it overrides an existing model that isn't a numbered die, set a font scale to prevent undesired fontScale from previous model
		if(!preset.fontScale && !["d2","d4","d6","d8","d10","d12","d14","d16","d20","d24","d30","d100","d1000","d10000"].includes(dice.type) && this.systems.get("standard").dice.has(dice.type))
			preset.fontScale = DICE_SCALE[shape];
		
		if(dice.bumpMaps && dice.bumpMaps.length)
			preset.setBumpMaps(dice.bumpMaps);

		if(dice.emissiveMaps && dice.emissiveMaps.length)
			preset.setEmissiveMaps(dice.emissiveMaps);

		if (dice.backgrounds) {
			preset.setBackgrounds(dice.backgrounds);
		}
		if (dice.labelScale) {
			preset.labelScale = dice.labelScale;
		}

		if(dice.emissive)
			preset.emissive = dice.emissive;

		if(dice.emissiveIntensity)
			preset.emissiveIntensity = dice.emissiveIntensity;

		if(dice.atlas)
			preset.atlas = dice.atlas;

		this.register(preset);

		if(dice.font && !foundry.applications.settings.menus.FontConfig.getAvailableFonts().includes(dice.font)){
			this.fontLoadingPromises.push(foundry.applications.settings.menus.FontConfig.loadFont(dice.font,{editor:false,fonts:[]}));
		}
	}

	//Is called when trying to create a DicePreset by guessing its faces from the CONFIG entries
	internalAddDicePreset(diceobj){
		let shape = "d";
		let fakeShape = [3,5,7];
		if(fakeShape.includes(diceobj.faces))
			shape += (diceobj.faces*2);
		else
			shape += diceobj.faces;
		let type = "d" + diceobj.constructor.DENOMINATION;
		let model = this.systems.get("standard").dice.get(shape);
		let preset = new DicePreset(type, model.shape);
		preset.term = diceobj.constructor.name;
		let labels = [];
		for(let i = 1;i<= diceobj.faces;i++){
			labels.push(diceobj.getResultLabel({result:i}));
		}
		preset.setLabels(labels);
		preset.setValues(1,diceobj.faces);
		preset.mass = model.mass;
		preset.inertia = model.inertia;
		preset.scale = model.scale;
		preset.internalAdd = true;
		this.register(preset);
	}

	disposeCachedMaterials(type = null){
		for (const material in this.baseMaterialCache) {
			if(type == null || material.substring(0,type.length) == type){
				const mat = this.baseMaterialCache[material];
				if(mat.map instanceof CanvasTexture)
					mat.map.dispose();
				if(mat.normalMap instanceof CanvasTexture)
					mat.normalMap.dispose();
				if(mat.emissiveMap instanceof CanvasTexture)
					mat.emissiveMap.dispose();
				if(mat.transmissionMap instanceof CanvasTexture)
					mat.transmissionMap.dispose();
				//chrome/iridescent reuse a height texture for metalnessMap, stored on userData
				if(mat.userData?.heightMap instanceof CanvasTexture)
					mat.userData.heightMap.dispose();
				if(mat.userData?.detailNormalMap instanceof CanvasTexture)
					mat.userData.detailNormalMap.dispose();
				mat.dispose();
				delete this.baseMaterialCache[material];
			}
		}
	}

	heightCanvasToNormalCanvas(srcCanvas, strength = this.normalMapStrength){
		const w = srcCanvas.width;
		const h = srcCanvas.height;
		const srcCtx = srcCanvas.getContext("2d");
		const srcData = srcCtx.getImageData(0, 0, w, h).data;

		//read the red channel as height - bump canvas is grayscale (white = high, dark = engraved)
		const raw = new Float32Array(w * h);
		for(let i = 0; i < w * h; i++) {
			raw[i] = srcData[i * 4] / 255.0;
		}

		//separable 1-2-1 Gaussian blur (3 passes ≈ 7×7 kernel) to smooth
		//high-frequency height noise before the Sobel pass
		const tmp = new Float32Array(w * h);
		let src = raw, dst = tmp;
		const blurPasses = 3;
		for(let pass = 0; pass < blurPasses; pass++) {
			const mid = (pass === blurPasses - 1) ? new Float32Array(w * h) : dst;
			for(let y = 0; y < h; y++) {
				for(let x = 0; x < w; x++) {
					const l = x > 0 ? src[y * w + x - 1] : src[y * w + x];
					const c = src[y * w + x];
					const r = x < w - 1 ? src[y * w + x + 1] : src[y * w + x];
					mid[y * w + x] = (l + 2 * c + r) * 0.25;
				}
			}
			for(let y = 0; y < h; y++) {
				for(let x = 0; x < w; x++) {
					const t = y > 0 ? mid[(y - 1) * w + x] : mid[y * w + x];
					const c = mid[y * w + x];
					const b = y < h - 1 ? mid[(y + 1) * w + x] : mid[y * w + x];
					dst[y * w + x] = (t + 2 * c + b) * 0.25;
				}
			}
			src = dst;
			dst = (src === tmp) ? raw : tmp;
		}
		const heights = src;

		const dstCanvas = document.createElement("canvas");
		dstCanvas.width = w;
		dstCanvas.height = h;
		const dstCtx = dstCanvas.getContext("2d");
		const dstImage = dstCtx.createImageData(w, h);
		const out = dstImage.data;

		const sample = (x, y) => {
			if(x < 0) x = 0; else if(x >= w) x = w - 1;
			if(y < 0) y = 0; else if(y >= h) y = h - 1;
			return heights[y * w + x];
		};

		for(let y = 0; y < h; y++) {
			for(let x = 0; x < w; x++) {
				const tl = sample(x - 1, y - 1);
				const t  = sample(x,     y - 1);
				const tr = sample(x + 1, y - 1);
				const l  = sample(x - 1, y);
				const r  = sample(x + 1, y);
				const bl = sample(x - 1, y + 1);
				const b  = sample(x,     y + 1);
				const br = sample(x + 1, y + 1);

				//Sobel kernels - gx = horizontal slope, gy = vertical slope (canvas-Y down)
				const gx = (tr + 2 * r + br) - (tl + 2 * l + bl);
				const gy = (bl + 2 * b + br) - (tl + 2 * t + tr);

				//build tangent-space normal. negate gradients so brighter (higher) regions
				//point outward; flipY=false on the texture aligns canvas-Y with V down.
				let nx = -gx * strength;
				let ny = -gy * strength;
				let nz = 1.0;
				const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
				nx /= len; ny /= len; nz /= len;

				const idx = (y * w + x) * 4;
				out[idx]     = (nx * 0.5 + 0.5) * 255;
				out[idx + 1] = (ny * 0.5 + 0.5) * 255;
				out[idx + 2] = (nz * 0.5 + 0.5) * 255;
				out[idx + 3] = 255;
			}
		}

		dstCtx.putImageData(dstImage, 0, 0);
		return dstCanvas;
	}

	//Stripped version from the Foundry Core library to avoid reloading fonts
	async _loadFonts(){
		const timeout = new Promise(resolve => setTimeout(resolve, 4500));
		const ready = Promise.all(this.fontLoadingPromises).then(() => document.fonts.ready);
		this.fontLoadingPromises = [];
		await Promise.race([ready, timeout]);
	}

	get(type) {
		return this.getPresetBySystem(type);
	}

	getPresetBySystem(type, system = "standard"){
		let model = this.systems.get("standard").dice.get(type);
		if(!model)
			return null;
		let diceobj = null;
		if(system != "standard"){
			if(this.systems.has(system)){
				// If it exists, we look for a similar shape
				diceobj = this.systems.get(system).dice.get(type)?.shape == model.shape ? this.systems.get(system).dice.get(type) : null;
				if(!diceobj && !['Coin', 'FateDie', 'Die'].includes(model.term)){
					//If it doesn't exist and is not a core DiceTerm, we look for a similar shape and values
					if(!model.colorset)
						diceobj = this.systems.get(system).getDiceByShapeAndValues(model.shape, model.values);
					else
						diceobj = null;
				}
			}
		}

		if(!diceobj){
			diceobj = this.systems.get("standard").dice.get(type);
		}
		return diceobj;
	}

	async create(scopedTextureCache, type, appearance, diceLibrary = null) {
		let diceobj = this.getPresetBySystem(type, appearance.system);
		if(diceobj.model && appearance.isGhost){
			diceobj = this.getPresetBySystem(type, "standard");
		}
		let scopedScale = (scopedTextureCache.type == "board" || scopedTextureCache.type == "persistent") ? this.baseScale : this.showcaseScale;
		if (!diceobj) return null;

		//ensure the resolved preset is fully loaded. preloadPresets only covers presets
		//referenced in saved appearance - presets reached via options.appearance override
		//or damage type mapping never get loaded there, so their labels stay as URL strings
		//and createMaterial silently draws nothing.
		if(!diceobj.modelLoaded){
			if(diceobj.modelFile)
				await diceobj.loadModel(this.loaderGLTF);
			else
				await diceobj.loadTextures();
		}
		let dicemesh;
		
		let geom = this.geometries[type+scopedScale];
		if(!geom) {
			geom = await this.createGeometry(diceobj.shape, diceobj.scale, scopedScale);
			this.geometries[type+scopedScale] = geom;
		}
		if (!geom) return null;

		// If we're on the board, we also create the shape in the physics worker
		if(scopedTextureCache.type == "board" || scopedTextureCache.type == "persistent"){
			await this.physicsWorker.exec("createShape", { type:diceobj.shape, radius:diceobj.scale * scopedScale });
		}

		if(diceobj.model){
			dicemesh = diceobj.model.scene.children[0].clone();
			dicemesh.userData.modelScale = (scopedScale / 100) * (diceobj.scaleModifier || 1);
			if(!dicemesh.geometry)
				dicemesh.geometry = {};
			if(diceobj.model.animations.length>0){
				dicemesh.mixer = new AnimationMixer(dicemesh);
				dicemesh.mixer.clipAction(diceobj.model.animations[0]).play();
			}

			//for each mesh, we need to clone the material, pass it to the system for optional processing and then cache it in the baseMaterialCache

			//first, we get all the different materials
			const materialList = new Set();
			dicemesh.traverse((child) => {
				if(child.isMesh) {
					materialList.add(child.material);
				}
			});

			//then we process each material or get the cached one
			for(let uniqueMaterial of materialList){
				let material;
				let baseMaterialCacheString = scopedTextureCache.type+type+appearance.system+uniqueMaterial.uuid+this.systems.get(appearance.system).getCacheString(appearance.systemSettings);
				if(this.baseMaterialCache[baseMaterialCacheString]) {
					material = this.baseMaterialCache[baseMaterialCacheString];
				} else {
					material = uniqueMaterial.clone();
					material = this.systems.get(appearance.system).processMaterial(type, material, appearance);
					material.onBeforeCompile = ShaderUtils.applyDiceSoNiceShader;

					if(!this.realisticLighting){
						material.envMap = scopedTextureCache.textureCube;
					}

					//finally, we cache the material
					this.baseMaterialCache[baseMaterialCacheString] = material;
				}
				//replace the original material with the processed based on the model material uuid
				dicemesh.traverse((child) => {
					if(child.isMesh) {
						if(child.material.uuid == uniqueMaterial.uuid){
							child.material = material;
						}
					}
				});
			}
		}else{
			let materialData = this.generateMaterialData(diceobj, appearance, diceLibrary);

			let baseMaterialCacheString = scopedTextureCache.type+type+materialData.cacheString+this.systems.get(appearance.system).getCacheString(appearance.systemSettings);
			let material;
			if(this.baseMaterialCache[baseMaterialCacheString]){
				material = this.baseMaterialCache[baseMaterialCacheString];
			}
			else {
				material = this.createMaterial(scopedTextureCache, baseMaterialCacheString, diceobj, materialData);
				//send to the system for processing
				material = this.systems.get(appearance.system).processMaterial(type, material, appearance);
				material.onBeforeCompile = ShaderUtils.applyDiceSoNiceShader;
			}
				
			dicemesh = new Mesh(geom, material);
			if(diceobj.scaleModifier && diceobj.scaleModifier !== 1){
				const s = diceobj.scaleModifier;
				dicemesh.scale.set(s, s, s);
			}

			//TODO: Find if this entire block is still needed
			//I think not
			if (diceobj.color) {
				dicemesh.material[0].color = new Color(diceobj.color);
				if(this.realisticLighting)
					dicemesh.material[0].color.convertLinearToSRGB();
				//dicemesh.material[0].emissive = new Color(diceobj.color);
				dicemesh.material[0].emissiveIntensity = diceobj.emissiveIntensity ? diceobj.emissiveIntensity : 1;
				dicemesh.material[0].needsUpdate = true;
				console.log("[Dice So Nice][Debug] If you see this message, please report it to the module author <3");
			}
			dicemesh.layers.enableAll();
		}

		dicemesh.result = null;
		dicemesh.shape = diceobj.shape;
		const that=dicemesh;
		dicemesh.getValue = async () => {
			const result = await this.physicsWorker.exec('getDiceValue', that.id);
			return result;
		};

		return dicemesh;
	}

	createMaterial(scopedTextureCache, baseMaterialCacheString, diceobj, materialData) {
		if(this.baseMaterialCache[baseMaterialCacheString])
			return this.baseMaterialCache[baseMaterialCacheString];

		let labels = diceobj.labels;
		if (diceobj.shape == 'd4') {
			labels = diceobj.labels[0];
			//d4 per-value overrides: swap the a/b/c/d source refs across all triplets.
			//editor writes libraryDie.faces keyed by die value (1..4); for d4 value N maps
			//to source index N-1. we identity-match the source in each triplet slot and
			//substitute it so every vertex of that value gets the override.
			const sources = diceobj._d4Sources;
			const overrides = materialData.perFaceOverrides || {};
			const hasValueOverride = (ov) => ov && (ov.labelImageObj || ov.labelText !== undefined);
			const valueKeys = Object.keys(overrides).filter(k => /^[1-4]$/.test(k) && hasValueOverride(overrides[k]));
			if (sources?.labels && valueKeys.length > 0) {
				const newLabelSources = [...sources.labels];
				const newBumpSources = sources.bumps ? [...sources.bumps] : null;
				const newEmissiveSources = sources.emissiveMaps ? [...sources.emissiveMaps] : null;
				for (const key of valueKeys) {
					const idx = parseInt(key, 10) - 1;
					const ov = overrides[key];
					//images replace labels, bumps, and (optionally) emissives.
					//text-only overrides just replace the label - bumps/emissives keep their
					//original source so the font stroke is drawn from the same canvas path.
					if (ov.labelImageObj) {
						newLabelSources[idx] = ov.labelImageObj;
						if (newBumpSources) newBumpSources[idx] = ov.labelImageObj;
						if (newEmissiveSources && ov.emissive !== false) newEmissiveSources[idx] = ov.labelImageObj;
					} else if (ov.labelText !== undefined) {
						newLabelSources[idx] = ov.labelText;
					}
				}
				const swapTriplet = (triplet, origSources, newSources) => triplet.map(t => {
					const idx = origSources.indexOf(t);
					return idx >= 0 ? newSources[idx] : t;
				});
				const rebuildFaceEntry = (faceEntry, origSources, newSources) => [
					faceEntry[0], //background array (not per-value)
					faceEntry[1], //[0,0,0] placeholder
					swapTriplet(faceEntry[2], origSources, newSources),
					swapTriplet(faceEntry[3], origSources, newSources),
					swapTriplet(faceEntry[4], origSources, newSources),
					swapTriplet(faceEntry[5], origSources, newSources),
				];
				labels = rebuildFaceEntry(diceobj.labels[0], sources.labels, newLabelSources);
				materialData._d4SwappedBumps = newBumpSources ? rebuildFaceEntry(diceobj.bumps[0], sources.bumps, newBumpSources) : null;
				materialData._d4SwappedEmissives = newEmissiveSources ? rebuildFaceEntry(diceobj.emissiveMaps[0], sources.emissiveMaps, newEmissiveSources) : null;
			}
		}
		//If the texture is an array of texture (for random face texture), we look at the first element to determine the faces material and the edge texture
		let dice_texture = Array.isArray(materialData.texture) ? materialData.texture[0] : materialData.texture;

		var mat;
		let materialSelected = this.material_options[materialData.material] ? this.material_options[materialData.material] : this.material_options["plastic"];
		if(!this.realisticLighting){
			delete materialSelected.roughnessMap;
		}
		switch(materialSelected.type){
			case "phong":
				mat = new MeshPhongMaterial(materialSelected.options);
				break;
			case "standard":
				mat = new MeshStandardMaterial(materialSelected.options);
				break;
			case "lambert":
				mat = new MeshLambertMaterial(materialSelected.options);
				break;
			case "physical":
				mat = new MeshPhysicalMaterial(materialSelected.options);
				break;
			default: //plastic
				mat = new MeshPhongMaterial(this.material_options.plastic.options);
		}
		if(materialSelected.scopedOptions){
			if(materialSelected.scopedOptions.envMap)
				mat.envMap = scopedTextureCache.textureCube;
			if(materialSelected.scopedOptions.roughnessMap)
				mat.roughnessMap = scopedTextureCache[materialSelected.scopedOptions.roughnessMap];
			if(materialSelected.scopedOptions.metalnessMap)
				mat.metalnessMap = scopedTextureCache[materialSelected.scopedOptions.metalnessMap];
			const materialNormalTex = scopedTextureCache[materialSelected.scopedOptions.normalMap];
			if(materialNormalTex) {
				mat.normalMap = materialNormalTex;
				mat.userData.hasMaterialNormalMap = true;
				mat.userData.detailNormalScale = materialSelected.scopedOptions.detailNormalScale ?? 1.0;
			}
		}
		let font = {
			"type":diceobj.font,
			"scale": diceobj.fontScale ? diceobj.fontScale:null
		};
		
		if(!font.type){
			font.type = materialData.font;
		}
		if(!font.scale){
			if(materialData.fontScale[diceobj.type])
				font.scale = materialData.fontScale[diceobj.type];
			else{
				font.scale = DICE_SCALE[diceobj.shape];
			}	
		}

		let canvas = document.createElement("canvas");
		let context = canvas.getContext("2d", {alpha: true});
		context.globalAlpha = 0;

		let canvasBump = document.createElement("canvas");
		let contextBump = canvasBump.getContext("2d", {alpha: true});
		contextBump.globalAlpha = 0;

		let canvasEmissive = document.createElement("canvas");
		let contextEmissive = canvasEmissive.getContext("2d");
		
		let labelsTotal = labels.length;
		let isHeritedFromShape = ["d3","d5","d7"].includes(diceobj.type) || (diceobj.type == "df"&&diceobj.shape == "d6");
		if(isHeritedFromShape){
			labelsTotal = labelsTotal*2 -2;
			if(diceobj.shape == "d2" || diceobj.shape == "d10")
				labelsTotal += 1;
		}

		let texturesPerLine = Math.ceil(Math.sqrt(labelsTotal));
		let sizeTexture = 256;
		let ts = this.calc_texture_size(Math.sqrt(labelsTotal)*sizeTexture, true);
		
		canvas.width = canvas.height = canvasBump.width = canvasBump.height = canvasEmissive.width = canvasEmissive.height = ts;
		//on d4 the editor stores overrides keyed by the click-reported die value, and the
		//glTF atlas UV maps tile N-1 onto the physical face whose click reports value N.
		//so shapeFace doubles as the lookup key directly - no faceValues translation needed.
		const resolveOverride = (labelIdx, shapeFace) => {
			let faceMaterialData = materialData;
			let faceFont = font;
			let faceLabels = labels;
			const lookupKey = String(shapeFace);
			if(materialData.perFaceOverrides && materialData.perFaceOverrides[lookupKey]) {
				const faceOverride = materialData.perFaceOverrides[lookupKey];
				faceMaterialData = foundry.utils.deepClone(materialData);
				//keep perFaceOverrides on the clone so the d4 triplet draw loop can do
				//per-vertex lookups below.
				faceMaterialData.perFaceOverrides = materialData.perFaceOverrides;
				if(diceobj.shape == 'd4') {
					//d4: only diceColor (background) / edge / texture are per-face.
					//label color, outline, font, text, image, and glow are per-label and
					//resolved per-vertex inside the d4 draw loop.
					if(faceOverride.background !== undefined) faceMaterialData.background = faceOverride.background;
					if(faceOverride.edge !== undefined) faceMaterialData.edge = faceOverride.edge;
					if(faceOverride.texture !== undefined) faceMaterialData.texture = faceOverride.texture;
				} else {
					foundry.utils.mergeObject(faceMaterialData, faceOverride, {overwrite: true});
					if(faceOverride.font) {
						faceFont = {type: faceOverride.font, scale: font.scale};
					}
					if(faceOverride.fontScale) {
						faceFont = {...faceFont, scale: (faceFont.scale || font.scale) * (faceOverride.fontScale / 100)};
					}
					if(faceOverride.labelImageObj) {
						faceLabels = [...labels];
						faceLabels[labelIdx] = faceOverride.labelImageObj;
					} else if(faceOverride.labelText !== undefined) {
						faceLabels = [...labels];
						faceLabels[labelIdx] = faceOverride.labelText;
					}
				}
			}
			return { faceMaterialData, faceFont, faceLabels };
		};

		let x = 0;
		let y = 0;
		let texturesOnThisLine = 0;
		let shapeFace = 0; // 1-based shape face counter
		const edgeOffset = labels.length - diceobj.values.length;
		for (var i = 0; i < labels.length; ++i) {
			if(texturesOnThisLine == texturesPerLine){
				y += sizeTexture;
				x = 0;
				texturesOnThisLine = 0;
			}

			if(i < edgeOffset)//edge
			{
				//if the texture is fully opaque, we do not use it for edge
				let texture = {name:"none"};
				if(dice_texture.composite != "source-over")
					texture = dice_texture;
				this.createTextMaterial(context, contextBump, contextEmissive, x, y, sizeTexture, diceobj, labels, font, i, texture, materialData);
			}
			else
			{
				shapeFace++;
				const { faceMaterialData, faceFont, faceLabels } = resolveOverride(i, shapeFace);
				let faceTexture = faceMaterialData.texture || materialData.texture;
				this.createTextMaterial(context, contextBump, contextEmissive, x, y, sizeTexture, diceobj, faceLabels, faceFont, i, faceTexture, faceMaterialData);
			}
			texturesOnThisLine++;
			x += sizeTexture;
		}

		//inherited shapes: draw repeated face tiles with per-face overrides
		if(isHeritedFromShape){
			let startI = 2;
			if(diceobj.shape == "d2" || diceobj.shape == "d10")
				startI = 1;
			for(i=startI;i<labels.length;i++){
				if(texturesOnThisLine == texturesPerLine){
					y += sizeTexture;
					x = 0;
					texturesOnThisLine = 0;
				}
				shapeFace++;
				const { faceMaterialData, faceFont, faceLabels } = resolveOverride(i, shapeFace);
				let faceTexture = faceMaterialData.texture || materialData.texture;
				this.createTextMaterial(context, contextBump, contextEmissive, x, y, sizeTexture, diceobj, faceLabels, faceFont, i, faceTexture, faceMaterialData);
				texturesOnThisLine++;
				x += sizeTexture;
			}
		}


		//var img    = canvas.toDataURL("image/png");
		//document.write('<img src="'+img+'"/>');
		//generate basetexture for caching
		if(!this.baseMaterialCache[baseMaterialCacheString]){
			let texture = new CanvasTexture(canvas);
			if(this.realisticLighting)
				texture.colorSpace = SRGBColorSpace;
			texture.flipY = false;
			mat.map = texture;
			mat.map.anisotropy = game.dice3d.box.anisotropy;

			if(this.realisticLighting){
				let normalCanvas = this.heightCanvasToNormalCanvas(canvasBump);
				let sobelNormalMap = new CanvasTexture(normalCanvas);
				sobelNormalMap.flipY = false;
				sobelNormalMap.anisotropy = game.dice3d.box.anisotropy;
				const nScale = Math.max(0.2, Math.min(1.0, mat.roughness / 0.3));
				if(mat.userData.hasMaterialNormalMap) {
					mat.normalScale = new Vector2(nScale, nScale);
					mat.userData.detailNormalMap = sobelNormalMap;
				} else {
					mat.normalMap = sobelNormalMap;
					mat.normalScale = new Vector2(nScale, nScale);
				}

				let emissiveMap = new CanvasTexture(canvasEmissive);
				if(this.realisticLighting)
					emissiveMap.colorSpace = SRGBColorSpace;
				emissiveMap.flipY = false;
				mat.emissiveMap = emissiveMap;

				let hasPresetEmissive = diceobj.emissive && diceobj.emissive !== 0x000000;
				if(hasPresetEmissive) {
					mat.emissiveIntensity = diceobj.emissiveIntensity ? diceobj.emissiveIntensity:1;
					mat.emissive = new Color(diceobj.emissive);
				} else if(materialData.emissiveLabels) {
					mat.emissiveIntensity = 0.7;
					mat.emissive = new Color(0xffffff);
				} else {
					mat.emissiveIntensity = diceobj.emissiveIntensity ? diceobj.emissiveIntensity:1;
					mat.emissive = new Color(diceobj.emissive);
				}
				if(this.realisticLighting)
					mat.emissive.convertLinearToSRGB();

				//per-face glow: build selective emissive map, keep full map in userData for SFX
				if(materialData.perFaceOverrides) {
					const baseHasEmissive = !!materialData.baseEmissive;
					const glowFaces = new Set();
					const shapeData = DICE_SHAPE[diceobj.shape];
					const shapeFaceCount = shapeData ? shapeData.faceValues.filter(v => v !== 0).length : diceobj.values.length;
					for(const [fv, ov] of Object.entries(materialData.perFaceOverrides)) {
						if(ov.emissive) glowFaces.add(String(fv));
					}
					if(baseHasEmissive) {
						for(let f = 1; f <= shapeFaceCount; f++) {
							const fv = String(f);
							const ov = materialData.perFaceOverrides[fv];
							if(!ov || ov.emissive !== false) {
								glowFaces.add(fv);
							}
						}
					}
					//d4 per-vertex glow: inner loop already skipped contextEmissive for
					//non-glow vertices, so canvasEmissive is the selective glow map.
					if(diceobj.shape == 'd4' && glowFaces.size > 0) {
						mat.userData.emissiveMapFull = emissiveMap;
						mat.userData.emissiveMapGlow = emissiveMap;
						mat.emissiveMap = emissiveMap;
						mat.emissive = new Color(0xffffff);
						if(this.realisticLighting)
							mat.emissive.convertLinearToSRGB();
						mat.emissiveIntensity = baseHasEmissive ? (diceobj.emissiveIntensity || 1) : 0.7;
					} else if(glowFaces.size > 0 && glowFaces.size < shapeFaceCount) {
						mat.userData.emissiveMapFull = emissiveMap;

						let canvasGlow = document.createElement("canvas");
						canvasGlow.width = canvasEmissive.width;
						canvasGlow.height = canvasEmissive.height;
						let ctxGlow = canvasGlow.getContext("2d");
						ctxGlow.fillStyle = "#000000";
						ctxGlow.fillRect(0, 0, canvasGlow.width, canvasGlow.height);

						//replay tile layout to match shape face indices to tile positions
						let gx = 0, gy = 0, gCount = 0, gShapeFace = 0;
						for(let gi = 0; gi < labels.length; gi++) {
							if(gCount == texturesPerLine) { gy += sizeTexture; gx = 0; gCount = 0; }
							if(gi >= edgeOffset) {
								gShapeFace++;
								if(glowFaces.has(String(gShapeFace))) {
									ctxGlow.drawImage(canvasEmissive, gx, gy, sizeTexture, sizeTexture, gx, gy, sizeTexture, sizeTexture);
								}
							}
							gCount++;
							gx += sizeTexture;
						}
						if(isHeritedFromShape) {
							let startI = 2;
							if(diceobj.shape == "d2" || diceobj.shape == "d10") startI = 1;
							for(let gi = startI; gi < labels.length; gi++) {
								if(gCount == texturesPerLine) { gy += sizeTexture; gx = 0; gCount = 0; }
								gShapeFace++;
								if(glowFaces.has(String(gShapeFace))) {
									ctxGlow.drawImage(canvasEmissive, gx, gy, sizeTexture, sizeTexture, gx, gy, sizeTexture, sizeTexture);
								}
								gCount++;
								gx += sizeTexture;
							}
						}

						let glowMap = new CanvasTexture(canvasGlow);
						glowMap.colorSpace = SRGBColorSpace;
						glowMap.flipY = false;
						mat.userData.emissiveMapGlow = glowMap;
						mat.emissiveMap = glowMap;
						mat.emissive = new Color(0xffffff);
						if(this.realisticLighting)
							mat.emissive.convertLinearToSRGB();
						mat.emissiveIntensity = baseHasEmissive ? (diceobj.emissiveIntensity || 1) : 0.7;
					}
				}
			}
		}

		switch(materialData.material){
			case "chrome":
			case "iridescent":
				if(this.realisticLighting) {
					let metalnessCanvas = document.createElement("canvas");
					metalnessCanvas.width = canvasBump.width;
					metalnessCanvas.height = canvasBump.height;
					let mCtx = metalnessCanvas.getContext("2d");
					const packedTex = scopedTextureCache[materialSelected.scopedOptions.metalnessMap];
					if(packedTex?.image) {
						const frame = scopedTextureCache._atlasFrames?.[materialSelected.scopedOptions.metalnessMap];
						if (frame) {
							mCtx.drawImage(packedTex.image, frame.x, frame.y, frame.w, frame.h, 0, 0, metalnessCanvas.width, metalnessCanvas.height);
						} else {
							mCtx.drawImage(packedTex.image, 0, 0, metalnessCanvas.width, metalnessCanvas.height);
						}
					} else {
						mCtx.fillStyle = "#0000ff";
						mCtx.fillRect(0, 0, metalnessCanvas.width, metalnessCanvas.height);
					}
					mCtx.globalCompositeOperation = 'multiply';
					mCtx.drawImage(canvasBump, 0, 0);
					let heightMap = new CanvasTexture(metalnessCanvas);
					heightMap.flipY = false;
					mat.metalnessMap = heightMap;
					mat.userData.heightMap = heightMap;
				}
				break;
		}
		
		mat.opacity = 1;
		mat.transparent = true;
		mat.depthTest = true;
		mat.needUpdate = true;
		mat.userData.materialData = materialData;

		if(this.advancedGlass && this.material_options[materialData.material]?.usesTransmissionMask) {
			let glassMaskMap = new CanvasTexture(canvasBump);
			glassMaskMap.flipY = false;
			mat.transmissionMap = glassMaskMap;
			mat.transparent = false;
			mat.userData.advancedGlassMask = true;
		}

		if(this.advancedGlass && materialData.material === 'resin') {
			let resinColor = new Color(materialData.background);
			if(resinColor.getHSL({}).l < 0.05) {
				resinColor = new Color(0.95, 0.95, 1.0);
			}
			mat.attenuationColor = resinColor;
		}

		mat.onBeforeCompile = ShaderUtils.applyDiceSoNiceShader;

		// deprecated shader hook
		Hooks.callAll("diceSoNiceOnMaterialReady", mat, baseMaterialCacheString);

		this.baseMaterialCache[baseMaterialCacheString] = mat;
		return mat;
	}
	
	applyCompositeDrawImage(ctx, img, frame, dx, dy, dw, dh, mode, color) {
		if (!mode || mode === 'source-over') {
			ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, dx, dy, dw, dh);
			return;
		}
		if (mode === 'hueshift') {
			const hsl = DiceColors.hexToHSL(color);
			const saturate = 0.5 + hsl.s * 1.5;
			const brightness = 0.5 + hsl.l;
			ctx.save();
			ctx.filter = `hue-rotate(${hsl.h}deg) saturate(${saturate}) brightness(${brightness})`;
			ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, dx, dy, dw, dh);
			ctx.restore();
			return;
		}
		if (!this._compositeOffscreen || this._compositeOffscreen.width < dw || this._compositeOffscreen.height < dh) {
			this._compositeOffscreen = document.createElement('canvas');
			this._compositeOffscreen.width = dw;
			this._compositeOffscreen.height = dh;
		}
		const off = this._compositeOffscreen.getContext('2d');
		off.clearRect(0, 0, dw, dh);
		off.globalCompositeOperation = 'source-over';
		off.drawImage(img, frame.x, frame.y, frame.w, frame.h, 0, 0, dw, dh);
		if (mode === 'multiply') {
			off.globalCompositeOperation = 'multiply';
			off.fillStyle = color;
			off.fillRect(0, 0, dw, dh);
			off.globalCompositeOperation = 'destination-in';
			off.drawImage(img, frame.x, frame.y, frame.w, frame.h, 0, 0, dw, dh);
		} else if (mode === 'tint') {
			off.globalCompositeOperation = 'source-atop';
			off.fillStyle = color;
			off.fillRect(0, 0, dw, dh);
		}
		ctx.drawImage(this._compositeOffscreen, 0, 0, dw, dh, dx, dy, dw, dh);
	}

	createTextMaterial(context, contextBump, contextEmissive, x, y, ts, diceobj, labels, font, index, texture, materialData) {
		if (labels[index] === undefined) return null;

		const FA_PRO_FAMILY = '"Font Awesome 7 Pro"';
		const buildFontStr = (size, type) => (type === FA_PRO_FAMILY ? '900 ' : '') + size + 'pt ' + type;

		let forecolor = materialData.foreground;
		let outlinecolor = materialData.outline;
		let backcolor = index > 0 ? materialData.background : materialData.edge != "" ? materialData.edge:materialData.background;

		if(Array.isArray(texture))
			texture = texture[Math.floor(Math.random() * texture.length)];
		
		let text = labels[index];
		let bump = diceobj.bumps[index];
		if (diceobj.shape == 'd4') {
			bump = (materialData._d4SwappedBumps || diceobj.bumps?.[0])?.[index];
		}
		let emissive = (diceobj.shape == 'd4' && materialData._d4SwappedEmissives)
			? materialData._d4SwappedEmissives[index]
			: diceobj.emissiveMaps[index];
		let isTexture = false;
		let margin = 1.0;

		// create color
		context.fillStyle = backcolor;
		context.fillRect(x, y, ts, ts);

		contextBump.fillStyle = "#FFFFFF";
		contextBump.fillRect(x, y, ts, ts);

		contextEmissive.fillStyle = "#000000";
		contextEmissive.fillRect(x, y, ts, ts);

		//context.rect(x, y, ts, ts);
		//context.stroke();

		//create underlying texture
		if (texture.name != '' && texture.name != 'none') {
			context.save();
			context.beginPath();
			context.rect(x,y,ts,ts);
			context.clip();
			if (texture.composite === 'hueshift') {
				const hsl = DiceColors.hexToHSL(backcolor);
				const saturate = 0.5 + hsl.s * 1.5;
				const brightness = 0.5 + hsl.l;
				context.filter = `hue-rotate(${hsl.h}deg) saturate(${saturate}) brightness(${brightness})`;
				context.globalCompositeOperation = 'source-over';
			} else {
				context.globalCompositeOperation = texture.composite || 'source-over';
			}
			context.drawImage(texture.texture.source, texture.texture.frame.x, texture.texture.frame.y, texture.texture.frame.w, texture.texture.frame.h, x, y, ts, ts);
			context.restore();
			
			if (texture.bump != '') {
				contextBump.drawImage(texture.bump.source, texture.bump.frame.x, texture.bump.frame.y, texture.bump.frame.w, texture.bump.frame.h, x, y, ts, ts);
			}
		}

		// create text
		context.globalCompositeOperation = 'source-over';
		context.textAlign = "center";
		context.textBaseline = "middle";

		contextBump.textAlign = "center";
		contextBump.textBaseline = "middle";

		contextEmissive.textAlign = "center";
		contextEmissive.textBaseline = "middle";
		
		if (diceobj.shape !== 'd4') {
			if(materialData.isGhost && labels[index] != "")
				text = "?";
			
			//apply background textures (faces only; edge tiles are at index < edgeOffset)
			const edgeOffset = diceobj.labels.length - diceobj.values.length;
			if (index >= edgeOffset) {
				const faceIndex = index - edgeOffset;
				const bkgBump = diceobj.bumps[0]?.[faceIndex];
				const bkgLabel = diceobj.labels[0]?.[faceIndex];
				const bkgEmissive = diceobj.emissiveMaps[0]?.[faceIndex];
				if (bkgBump && bkgBump.source instanceof HTMLImageElement) {
					contextBump.drawImage(bkgBump.source, bkgBump.frame.x, bkgBump.frame.y, bkgBump.frame.w, bkgBump.frame.h, x, y, ts, ts);
				}
				if (bkgLabel && bkgLabel.source instanceof HTMLImageElement) {
					this.applyCompositeDrawImage(context, bkgLabel.source, bkgLabel.frame, x, y, ts, ts, materialData.backgroundComposite, backcolor);
				}
				if (bkgEmissive && bkgEmissive.source instanceof HTMLImageElement) {
					contextEmissive.drawImage(bkgEmissive.source, bkgEmissive.frame.x, bkgEmissive.frame.y, bkgEmissive.frame.w, bkgEmissive.frame.h, x, y, ts, ts);
				}
			}

			//custom texture face
			if(text.source instanceof HTMLImageElement){
				isTexture = true;
				//per-face override: use custom image for bump and emissive too
				if(materialData.labelImageObj) {
					bump = text;
					emissive = materialData.emissive !== false ? text : null;
				}
				//label image with scale, flip and vertical position
				if(materialData.labelImageScale !== undefined) {
					const scale = (materialData.labelImageScale ?? 100) / 100;
					const flip = materialData.labelImageFlip || false;
					const vpos = (materialData.labelImagePosition ?? 50) / 100;
					const drawSize = ts * scale;
					const dx = x + (ts - drawSize) / 2;
					//vpos 0=shifted up, 0.5=centered, 1=shifted down
					const maxOffset = ts / 2;
					const dy = y + (ts - drawSize) / 2 + (vpos - 0.5) * 2 * maxOffset;
					const drawImg = (ctx, src, compositeMode, compositeColor) => {
						ctx.save();
						ctx.beginPath();
						ctx.rect(x, y, ts, ts);
						ctx.clip();
						if(flip) {
							ctx.translate(0, y + ts);
							ctx.scale(1, -1);
							if (compositeMode) {
								this.applyCompositeDrawImage(ctx, src.source, src.frame, dx, y + ts - dy - drawSize, drawSize, drawSize, compositeMode, compositeColor);
							} else {
								ctx.drawImage(src.source, src.frame.x, src.frame.y, src.frame.w, src.frame.h,
									dx, y + ts - dy - drawSize, drawSize, drawSize);
							}
						} else {
							if (compositeMode) {
								this.applyCompositeDrawImage(ctx, src.source, src.frame, dx, dy, drawSize, drawSize, compositeMode, compositeColor);
							} else {
								ctx.drawImage(src.source, src.frame.x, src.frame.y, src.frame.w, src.frame.h,
									dx, dy, drawSize, drawSize);
							}
						}
						ctx.restore();
					};
					drawImg(context, text, materialData.labelComposite, forecolor);
					if(bump) drawImg(contextBump, bump);
					if(emissive) drawImg(contextEmissive, emissive);
				} else if (diceobj.labelScale) {
					//preset-level opt-in scaling for custom presets registered via addDicePreset
					const textureSize = ts * diceobj.labelScale;
					const dx = x + ts/2 - textureSize/2;
					const dy = y + ts/2 - textureSize/2;
					this.applyCompositeDrawImage(context, text.source, text.frame, dx, dy, textureSize, textureSize, materialData.labelComposite, forecolor);
					if(bump)
						contextBump.drawImage(bump.source, bump.frame.x, bump.frame.y, bump.frame.w, bump.frame.h, dx, dy, textureSize, textureSize);
					if(emissive)
						contextEmissive.drawImage(emissive.source, emissive.frame.x, emissive.frame.y, emissive.frame.w, emissive.frame.h, dx, dy, textureSize, textureSize);
				} else {
					this.applyCompositeDrawImage(context, text.source, text.frame, x, y, ts, ts, materialData.labelComposite, forecolor);
					if(bump)
						contextBump.drawImage(bump.source, bump.frame.x, bump.frame.y, bump.frame.w, bump.frame.h,x,y,ts,ts);
					if(emissive)
						contextEmissive.drawImage(emissive.source, emissive.frame.x, emissive.frame.y, emissive.frame.w, emissive.frame.h,x,y,ts,ts);
				}
			}
			else{
				//clip text to face tile so it doesn't bleed into neighbours
				context.save();
				context.beginPath();
				context.rect(x, y, ts, ts);
				context.clip();
				contextBump.save();
				contextBump.beginPath();
				contextBump.rect(x, y, ts, ts);
				contextBump.clip();
				contextEmissive.save();
				contextEmissive.beginPath();
				contextEmissive.rect(x, y, ts, ts);
				contextEmissive.clip();

				//faux-engraved look: shadow only affects fillText/strokeText on the bump canvas
				contextBump.shadowColor = "#000000";
				contextBump.shadowOffsetX = 1;
				contextBump.shadowOffsetY = 1;
				contextBump.shadowBlur = 3;

				let fontsize = ts / (1 + 2 * margin);
				let textstarty = (ts / 2);
				let textstartx = (ts / 2);

				if(font.scale)
					fontsize *= font.scale;

				//Needed for every fonts
				switch(diceobj.shape){
					case 'd10':
						textstarty = textstartx*1.3;
						break
					case 'd14':
						textstarty = textstartx*1.4;
						break
					case 'd16':
						textstarty = textstartx*1.4;
						break
					case 'd8':
						textstarty = textstarty*1.1;
						break;
					case 'd12':
						textstarty = textstarty*1.08;
						break;
					case 'd20':
						textstarty = textstartx*1.2;
						break;
					case 'd6':
						textstarty = textstarty*1.1;
						break;
				}

				let fontStr = buildFontStr(fontsize, font.type);
				context.font = fontStr;
				contextBump.font = fontStr;
				contextEmissive.font = fontStr;

				var lineHeight = fontsize;

				let textlines = text.split?.("\n") ?? [];

				if (textlines.length > 1) {
					fontsize = fontsize / textlines.length;
					fontStr = buildFontStr(fontsize, font.type);
					context.font = fontStr;
					contextBump.font = fontStr;
					contextEmissive.font = fontStr;

					//to find the correct text height for every possible fonts, we have no choice but to use the great (and complex) pixi method
					//First we create a PIXI.TextStyle object, to pass later to the measure method
					let pixiStyle = new PIXI.TextStyle({
						fontFamily: font.type,
						fontSize: fontsize,
						stroke: "#0000FF",
						strokeThickness: (outlinecolor != 'none' && outlinecolor != backcolor) ? 1:0
					});
					//Then we call the PIXI measureText method
					let textMetrics = PIXI.TextMetrics.measureText(textlines.join(""),pixiStyle);

					lineHeight = textMetrics.lineHeight;
					if(textlines[0]!=""){
						textstarty -= (lineHeight * textlines.length) / 2;
						//On a D12, we add a little padding because it looks better to human eyes even tho it's not really the center anymore
						if(diceobj.shape == "d12")
							textstarty = textstarty *1.08;
					}
					else
						textlines.shift();
				}

				for(let i = 0, l = textlines.length; i < l; i++){
					let textline = textlines[i].trim();

					// attempt to outline the text with a meaningful color
					if (outlinecolor != 'none' && outlinecolor != backcolor) {
						context.strokeStyle = outlinecolor;
						context.lineWidth = 5;
						context.strokeText(textlines[i], textstartx+x, textstarty+y);

						contextBump.strokeStyle = "#555555";
						contextBump.lineWidth = 5;
						contextBump.strokeText(textlines[i], textstartx+x, textstarty+y);

						contextEmissive.strokeStyle = "#999999";
						contextEmissive.lineWidth = 5;
						contextEmissive.strokeText(textlines[i], textstartx+x, textstarty+y);

						if (textline == '6' || textline == '9') {
							context.strokeText('  .', textstartx+x, textstarty+y);
							contextBump.strokeText('  .', textstartx+x, textstarty+y);
							contextEmissive.strokeText('  .', textstartx+x, textstarty+y);
						}
					}

					context.fillStyle = forecolor;
					context.fillText(textlines[i], textstartx+x, textstarty+y);

					contextBump.fillStyle = "#555555";
					contextBump.fillText(textlines[i], textstartx+x, textstarty+y);

					contextEmissive.fillStyle = "#999999";
					contextEmissive.fillText(textlines[i], textstartx+x, textstarty+y);

					if (textline == '6' || textline == '9') {
						context.fillText('  .', textstartx+x, textstarty+y);
						contextBump.fillText('  .', textstartx+x, textstarty+y);
						contextEmissive.fillText('  .', textstartx+x, textstarty+y);
					}
					textstarty += (lineHeight * 1.5);
				}
				context.restore();
				contextBump.restore();
				contextEmissive.restore();
			}

		} else {

			var hw = (ts / 2);
			var hh = (ts / 2);
			const baseFontSize = (ts / 128 * 24);
			let fontsize = baseFontSize;
			if(font.scale)
				fontsize *= font.scale;
			const baseFontStr = buildFontStr(fontsize, font.type);
			context.font = baseFontStr;
			contextBump.font = baseFontStr;
			contextEmissive.font = baseFontStr;

			//d4 triplet → original vertex values. shared constant imported from DicePreset
			//so the row 0 layout used there and the value lookup used here cannot drift.
			const d4ShapeFace = diceobj.shape == 'd4' ? (index - 1) : 0;
			const d4VertexValues = diceobj.shape == 'd4' ? D4_TRIPLET_VALUES[d4ShapeFace - 1] : null;
			const d4Overrides = diceobj.shape == 'd4' ? (materialData.perFaceOverrides || null) : null;
			//glow control only kicks in when emissive is explicitly set per value or a base
			//glow is on - otherwise default #999999 emissive rendering applies to all vertices.
			const d4GlowControl = d4Overrides && (
				!!materialData.baseEmissive ||
				Object.values(d4Overrides).some(ov => ov?.emissive !== undefined)
			);
			const isD4VertexGlowing = (vertexValue) => {
				const ov = d4Overrides?.[String(vertexValue)];
				if (ov?.emissive === true) return true;
				if (ov?.emissive === false) return false;
				return !!materialData.baseEmissive;
			};

			//clip d4 face tile so vertex labels and backgrounds don't bleed into neighbours
			context.save();
			context.beginPath();
			context.rect(x, y, ts, ts);
			context.clip();
			contextBump.save();
			contextBump.beginPath();
			contextBump.rect(x, y, ts, ts);
			contextBump.clip();
			contextEmissive.save();
			contextEmissive.beginPath();
			contextEmissive.rect(x, y, ts, ts);
			contextEmissive.clip();

			//d4 background draw: same edgeOffset convention as non-d4, but derived from the
			//row structure (labels is diceobj.labels[0], a 6-slot row: [bgArr, placeholder, t1..t4])
			const d4EdgeOffset = labels.length - diceobj.values.length;
			if (index >= d4EdgeOffset) {
				const faceIndex = index - d4EdgeOffset;
				const bkgBump = diceobj.bumps[0]?.[0]?.[faceIndex];
				const bkgLabel = diceobj.labels[0]?.[0]?.[faceIndex];
				const bkgEmissive = diceobj.emissiveMaps[0]?.[0]?.[faceIndex];
				if (bkgBump && bkgBump.source instanceof HTMLImageElement) {
					contextBump.drawImage(bkgBump.source, bkgBump.frame.x, bkgBump.frame.y, bkgBump.frame.w, bkgBump.frame.h,x,y,ts,ts);
				}
				if (bkgLabel && bkgLabel.source instanceof HTMLImageElement) {
					this.applyCompositeDrawImage(context, bkgLabel.source, bkgLabel.frame, x, y, ts, ts, materialData.backgroundComposite, backcolor);
				}
				if (bkgEmissive && bkgEmissive.source instanceof HTMLImageElement) {
					contextEmissive.drawImage(bkgEmissive.source, bkgEmissive.frame.x, bkgEmissive.frame.y, bkgEmissive.frame.w, bkgEmissive.frame.h,x,y,ts,ts);
				}
			}

			//draw the numbers
			let wShift = 1;
			let hShift = 1;
			if (index > 0) {
				for (let i=0;i<text.length;i++) {
					if(materialData.isGhost)
						text[i] = "?";
					switch(i){
						case 0:
							hShift = 1.13;
							break;
						case 1:
							hShift=0.87;
							wShift=1.13;
							break;
						case 2:
							wShift = 0.87;
					}
					let destX = hw*wShift+x;
					let destY = (hh - ts * 0.3)*hShift+y;

					//d4 per-vertex override lookup: font, image options, glow gating.
					//overrides are keyed by the value the vertex originally shows, so every
					//instance of that label across the die inherits the same settings.
					let vertexOv = null;
					let vertexValue = null;
					let vertexDrawEmissive = true;
					if (d4VertexValues) {
						vertexValue = d4VertexValues[i];
						vertexOv = d4Overrides?.[String(vertexValue)] || null;
						vertexDrawEmissive = d4GlowControl ? isD4VertexGlowing(vertexValue) : true;
						let vertexFontType = font.type;
						let vertexFontSize = fontsize;
						if (vertexOv) {
							if (vertexOv.font) vertexFontType = vertexOv.font;
							if (vertexOv.fontScale) vertexFontSize = baseFontSize * (font.scale || 1) * (vertexOv.fontScale / 100);
						}
						const vertexFontStr = buildFontStr(vertexFontSize, vertexFontType);
						context.font = vertexFontStr;
						contextBump.font = vertexFontStr;
						contextEmissive.font = vertexFontStr;
					}
					//custom texture face
					if(text[i].source instanceof HTMLImageElement){
						isTexture = true;
						let baseTextureSize = 60 / (text[i].frame.w / ts);
						if (diceobj.labelScale) {
							baseTextureSize = 120 * diceobj.labelScale;
						}
						//d4 per-value image options: scale, flip, vertical offset along the
						//local y axis (which points from center toward the vertex after rotation)
						let scaleFactor = 1;
						let flipImg = false;
						let vOffset = 0;
						if (vertexOv) {
							if (vertexOv.labelImageScale !== undefined) scaleFactor = (vertexOv.labelImageScale ?? 100) / 100;
							if (vertexOv.labelImageFlip) flipImg = true;
							if (vertexOv.labelImagePosition !== undefined) {
								//0 = pulled toward vertex, 0.5 = default, 1 = pushed toward face center
								vOffset = ((vertexOv.labelImagePosition ?? 50) / 100 - 0.5) * (ts / 2);
							}
						}
						const textureSize = baseTextureSize * scaleFactor;
						const imgCenterY = destY + vOffset;

						const drawVertexImg = (ctx, src, frameX, frameY) => {
							if (flipImg) {
								ctx.save();
								ctx.translate(destX, imgCenterY);
								ctx.scale(1, -1);
								ctx.drawImage(src.source, frameX, frameY, src.frame.w, src.frame.h,
									-textureSize/2, -textureSize/2, textureSize, textureSize);
								ctx.restore();
							} else {
								ctx.drawImage(src.source, frameX, frameY, src.frame.w, src.frame.h,
									destX - textureSize/2, imgCenterY - textureSize/2, textureSize, textureSize);
							}
						};

						drawVertexImg(context, text[i], text[i].frame.x, text[i].frame.y);
						if(bump) {
							drawVertexImg(contextBump, bump[i], bump[i].frame.x, bump[i].frame.y);
						}
						if(emissive && vertexDrawEmissive)
							drawVertexImg(contextEmissive, text[i], text[i].frame.x, text[i].frame.y);
					}

					else{
						//d4 per-label label color / outline color
						let vertexForecolor = forecolor;
						let vertexOutlinecolor = outlinecolor;
						if (vertexOv) {
							if (vertexOv.foreground !== undefined && vertexOv.foreground !== null && vertexOv.foreground !== '') {
								vertexForecolor = vertexOv.foreground;
							}
							if (vertexOv.outline !== undefined && vertexOv.outline !== null) {
								vertexOutlinecolor = vertexOv.outline;
							}
						}

						// attempt to outline the text with a meaningful color
						if (vertexOutlinecolor != 'none' && vertexOutlinecolor != backcolor) {
							context.strokeStyle = vertexOutlinecolor;

							context.lineWidth = 5;
							context.strokeText(text[i], destX, destY);

							contextBump.strokeStyle = "#555555";
							contextBump.lineWidth = 5;
							contextBump.strokeText(text[i], destX, destY);

							if (vertexDrawEmissive) {
								contextEmissive.strokeStyle = "#999999";
								contextEmissive.lineWidth = 5;
								contextEmissive.strokeText(text[i], destX, destY);
							}
						}

						//draw label in top middle section
						context.fillStyle = vertexForecolor;
						context.fillText(text[i], destX, destY);
						contextBump.fillStyle = "#555555";
						contextBump.fillText(text[i], destX, destY);
						if (vertexDrawEmissive) {
							contextEmissive.fillStyle = "#999999";
							contextEmissive.fillText(text[i], destX, destY);
						}
						//var img    = canvas.toDataURL("image/png");
						//document.write('<img src="'+img+'"/>');
					}

					//rotate 1/3 for next label
					context.translate(hw+x, hh+y);
					context.rotate(Math.PI * 2 / 3);
					context.translate(-hw-x, -hh-y);

					contextBump.translate(hw+x, hh+y);
					contextBump.rotate(Math.PI * 2 / 3);
					contextBump.translate(-hw-x, -hh-y);

					contextEmissive.translate(hw+x, hh+y);
					contextEmissive.rotate(Math.PI * 2 / 3);
					contextEmissive.translate(-hw-x, -hh-y);
				}
			}

			context.restore();
			contextBump.restore();
			contextEmissive.restore();
		}
	}

	getAppearanceForDice(appearances, dicetype, dicenotation = null){
		/*
			We use either (by order of priority):
			1) A notation appearance
			2) A flavor/notation colorset
			3) The colorset of the diceobj
			4) The colorset configured by the player for this dice type
			5) A preferred system set by a module/system (done in main.js)
			6) The global colorset of the player
		*/

		// save-as-source: if the damage type maps to a saved profile, replace appearances
		if(dicenotation){
			const detected = this.detectDamageType(dicenotation);
			if(detected){
				const mapped = this.resolveDamageTypeMapping(detected);
				if(mapped?.saveName){
					const saveAppearance = game.users.get(mapped.saveOwner)
						?.getFlag("dice-so-nice", "saves")
						?.[mapped.saveName]
						?.appearance;
					if(saveAppearance) appearances = saveAppearance;
				}
			}
		}

		let settings;
		if(appearances[dicetype])
			settings = appearances[dicetype];
		else
			settings = appearances.global;

		//To keep compatibility with both older integrations and user settings, we use the DiceColor naming convention from there
		let appearance = {
			colorset: settings.colorset ? settings.colorset : appearances.global.colorset ? appearances.global.colorset : "custom",
			foreground: settings.labelColor ? settings.labelColor:appearances.global.labelColor ? appearances.global.labelColor : "#FFFFFF",
			background: settings.diceColor ? settings.diceColor:appearances.global.diceColor ? appearances.global.diceColor : "#000000",
			//outline: settings.outlineColor ? settings.outlineColor: appearances.global.outlineColor ? appearances.global.outlineColor : "",
			//edge: settings.edgeColor ? settings.edgeColor:appearances.global.edgeColor ? appearances.global.edgeColor:"",
			texture: settings.texture ? settings.texture:appearances.global.texture ? appearances.global.texture : "none",
			material: settings.material ? settings.material:appearances.global.material ? appearances.global.material : "auto",
			font: settings.font ? settings.font:appearances.global.font ? appearances.global.font : "Arial",
			system: settings.system ? settings.system:appearances.global.system ? appearances.global.system : "standard",
			systemSettings: settings.systemSettings ? settings.systemSettings:appearances.global.systemSettings ? appearances.global.systemSettings : {}
		};

		//Merge with the default systemSettings to aply default values
		if(!this.systems.has(appearance.system))
			appearance.system = "standard";

		const system = this.systems.get(appearance.system);
		const defaultSystemSettings = system.getDefaultSettings();
		foundry.utils.mergeObject(appearance.systemSettings, defaultSystemSettings, { overwrite: false });

		//Check if this dice exists for this system. If not, it means it is the one from global
		if(!system || !system.dice.has(dicetype))
			appearance.system = "standard";

		if(appearance.colorset == "custom"){
			appearance.outline = settings.outlineColor ? settings.outlineColor:"";
			appearance.edge = settings.edgeColor ? settings.edgeColor:"";
		} else {
			appearance.outline = settings.outlineColor ? settings.outlineColor: appearances.global.outlineColor ? appearances.global.outlineColor : "";
			appearance.edge = settings.edgeColor ? settings.edgeColor:appearances.global.edgeColor ? appearances.global.edgeColor:"";
		}

		if(appearance.colorset && appearance.colorset != "custom"){
			let colorsetData = DiceColors.getColorSet(appearance.colorset);
			appearance.foreground = colorsetData.foreground;
			appearance.background = colorsetData.background;
			appearance.outline = colorsetData.outline;
			appearance.edge = colorsetData.edge ? colorsetData.edge : "";
			if(appearance.material == "auto" && colorsetData.material)
				appearance.material = colorsetData.material;
		}
		let diceobj = this.getPresetBySystem(dicetype,appearance.system);
		if(diceobj.colorset){
			let colorsetData = {...DiceColors.getColorSet(diceobj.colorset)};
			Object.entries(colorsetData).forEach((opt) => {
				if(opt[1] == "custom")
					delete colorsetData[opt[0]];
			});
			foundry.utils.mergeObject(appearance, colorsetData,{applyOperators:true});
			appearance.colorset = diceobj.colorset;
		}
		
		let suppressLibraryDie = false;
		if(dicenotation){
			let colorset = null;
			let mappedPreset = null;

			//priority 1: explicit dsn colorset on the term still wins
			if (dicenotation.options.colorset) {
				colorset = dicenotation.options.colorset;
				suppressLibraryDie = true;
			} else {
				//priority 2: damage type detection (type first, then flavor) routed through the map
				const detected = this.detectDamageType(dicenotation);
				if (detected) {
					const mapped = this.resolveDamageTypeMapping(detected);
					if (mapped?.preset) {
						//custom preset wins - overrides system for this die only
						mappedPreset = mapped.preset;
						suppressLibraryDie = true;
					} else if (mapped?.colorset) {
						colorset = mapped.colorset;
						suppressLibraryDie = true;
					}
				}
				//priority 3: explicit colorset on the appearance payload
				if (!colorset && !mappedPreset && dicenotation.options.appearance?.colorset && COLORSETS[dicenotation.options.appearance.colorset]) {
					colorset = dicenotation.options.appearance.colorset;
				}
			}

			// If we do, we retrieve the colorset data
			if(colorset){
				let colorsetData = DiceColors.getColorSet(colorset);
				colorsetData.edge = colorsetData.edge ? colorsetData.edge : "";
				//save system and systemSettings before we overwrite them
				colorsetData.system = appearance.system;
				colorsetData.systemSettings = appearance.systemSettings;
				appearance = colorsetData;
			}

			//if the map routed to a custom preset, swap the system for this die
			if(mappedPreset && this.systems.has(mappedPreset)){
				const mappedSystem = this.systems.get(mappedPreset);
				if(mappedSystem.dice.has(dicetype)){
					appearance.system = mappedPreset;
					//pull in that system's default settings so rendering doesn't inherit the old system's knobs
					appearance.systemSettings = foundry.utils.deepClone(mappedSystem.getDefaultSettings());
					//if the mapped preset has its own colorset, apply it unless another colorset already won
					const mappedDiceobj = this.getPresetBySystem(dicetype, mappedPreset);
					if(mappedDiceobj?.colorset && !colorset){
						let colorsetData = {...DiceColors.getColorSet(mappedDiceobj.colorset)};
						Object.entries(colorsetData).forEach((opt) => {
							if(opt[1] == "custom")
								delete colorsetData[opt[0]];
						});
						foundry.utils.mergeObject(appearance, colorsetData,{applyOperators:true});
						appearance.colorset = mappedDiceobj.colorset;
					}
				}
			}

			// Then we overwrite the colorset data with the appearance to let players override the colorset default colors
			if(dicenotation.options.appearance){
				const previousSystem = appearance.system;
				foundry.utils.mergeObject(appearance, dicenotation.options.appearance,{applyOperators:true});
				//if the override swapped to a different system, re-resolve its diceobj so the correct
				//colorset/textures follow (otherwise we'd render the new system's system id with the old system's textures)
				if(appearance.system && appearance.system !== previousSystem && this.systems.has(appearance.system)){
					const overrideSystem = this.systems.get(appearance.system);
					if(overrideSystem.dice.has(dicetype)){
						//refresh systemSettings unless the caller explicitly set them
						if(!dicenotation.options.appearance.systemSettings){
							appearance.systemSettings = foundry.utils.deepClone(overrideSystem.getDefaultSettings());
						}
						const overrideDiceobj = this.getPresetBySystem(dicetype, appearance.system);
						if(overrideDiceobj?.colorset){
							const colorsetData = {...DiceColors.getColorSet(overrideDiceobj.colorset)};
							Object.entries(colorsetData).forEach(([k, v]) => { if(v === "custom") delete colorsetData[k]; });
							foundry.utils.mergeObject(appearance, colorsetData, {applyOperators:true});
							appearance.colorset = overrideDiceobj.colorset;
						}
						//last: re-apply any explicit overrides from dicenotation.options.appearance on top
						foundry.utils.mergeObject(appearance, dicenotation.options.appearance, {applyOperators:true});
					}
				}
			}
			if(dicenotation.options.ghost){
				appearance.isGhost = true;
			}
		}
		if(!suppressLibraryDie && settings.libraryDieId){
			appearance.libraryDieId = settings.libraryDieId;
		}
		if(!suppressLibraryDie && settings.libraryDieOwner){
			appearance.libraryDieOwner = settings.libraryDieOwner;
		}
		return appearance;
	}

	//walk the term-level options looking for a damage type signal
	//roll-level options are merged down into dice terms by Dice3D before we get here
	//gate is handled in DiceNotation.js - if flavor/type made it here, the user setting allows it
	detectDamageType(dicenotation){
		if(!dicenotation?.options) return null;
		if(dicenotation.options.dsnDamageTypeManaged)
			return dicenotation.options.dsnDamageType ?? null;
		const type = dicenotation.options.type;
		if(type && typeof type === "string") return type;
		const flavor = dicenotation.options.flavor;
		if(flavor && typeof flavor === "string") return flavor;
		return null;
	}

	//resolve a damage type id to a mapping entry {colorset?, preset?} or {saveName, saveOwner}
	//order: GM override (damageTypeMap) > dev default (damageTypeDefaults) > legacy name==colorset match
	resolveDamageTypeMapping(detectedType){
		if(!detectedType) return null;
		let map = {};
		try {
			map = game.settings.get("dice-so-nice", "damageTypeMap") ?? {};
		} catch(e) {
			map = {};
		}
		const entry = map[detectedType];
		if(entry){
			if(entry.saveName && entry.saveOwner) return { saveName: entry.saveName, saveOwner: entry.saveOwner };
			if(entry.preset || entry.colorset) return entry;
		}
		const dev = this.damageTypeDefaults.get(detectedType);
		if(dev && (dev.preset || dev.colorset)) return { preset: dev.preset ?? null, colorset: dev.colorset ?? null };
		if(COLORSETS[detectedType]) return { colorset: detectedType, preset: null };
		return null;
	}

	generateMaterialData(diceobj, appearance, diceLibrary = null) {
		let materialData = {};
		let colorindex;

		if(appearance.texture && !appearance.texture.id)
			appearance.texture = DiceColors.getTexture(appearance.texture);

		let colorsetData = DiceColors.getColorSet(appearance.colorset);

		// ignore custom colorset with unset properties
		if(colorsetData.foreground == "custom")
			colorsetData.foreground = appearance.foreground;
		if(colorsetData.background == "custom")
			colorsetData.background = appearance.background;
		if(colorsetData.texture == "custom")
			colorsetData.texture = appearance.texture;
		if(colorsetData.material == "custom")
			colorsetData.material = appearance.material;
		if(colorsetData.font == "custom")
			colorsetData.font = appearance.font;


		// set base color first
		if (Array.isArray(appearance.background)) {

			colorindex = Math.floor(Math.random() * appearance.background.length);

			// if color list and label list are same length, treat them as a parallel list
			if (Array.isArray(appearance.foreground) && appearance.foreground.length == appearance.background.length) {
				materialData.foreground = appearance.foreground[colorindex];

				// if label list and outline list are same length, treat them as a parallel list
				if (Array.isArray(appearance.outline) && appearance.outline.length == appearance.foreground.length) {
					materialData.outline = appearance.outline[colorindex];
				}
			}
			// if texture list is same length do the same
			if (Array.isArray(appearance.texture) && appearance.texture.length == appearance.background.length) {
				materialData.texture = appearance.texture[colorindex];
			}

			//if edge list and color list are same length, treat them as a parallel list
			if (Array.isArray(appearance.edge) && appearance.edge.length == appearance.background.length) {
				materialData.edge = appearance.edge[colorindex];
			}

			if (Array.isArray(appearance.material) && appearance.material.length == appearance.background.length) {
				materialData.material = appearance.material[colorindex];
			}

			materialData.background = appearance.background[colorindex];
		} else {
			materialData.background = appearance.background;
		}

		if(!materialData.edge){
			if (Array.isArray(appearance.edge)) {
				colorindex = Math.floor(Math.random() * appearance.edge.length);
				materialData.edge = appearance.edge[colorindex];
			}
			else
				materialData.edge = appearance.edge;
		}

		// if selected label color is still not set, pick one
		if(!materialData.foreground){
			if(Array.isArray(appearance.foreground)){
				colorindex = appearance.foreground[Math.floor(Math.random() * appearance.foreground.length)];

				// if label list and outline list are same length, treat them as a parallel list
				if (Array.isArray(appearance.outline) && appearance.outline.length == appearance.foreground.length) {
					materialData.outline = appearance.outline[colorindex];
				}

				materialData.foreground = appearance.foreground[colorindex];
			}
			else
				materialData.foreground = appearance.foreground;
		}

		// if selected label outline is still not set, pick one
		if (!materialData.outline){
			if(Array.isArray(appearance.outline)) {
				colorindex = appearance.outline[Math.floor(Math.random() * appearance.outline.length)];

				materialData.outline = appearance.outline[colorindex];
			} else {
				materialData.outline = appearance.outline;
			}
		}

		// same for textures list
		if(!materialData.texture){
			if (Array.isArray(appearance.texture)) {
				materialData.texture = appearance.texture[Math.floor(Math.random() * appearance.texture.length)];
			} else if(appearance.texture.name == "none"){
				//set to none/theme
				if (Array.isArray(colorsetData.texture)){
					materialData.texture = colorsetData.texture[Math.floor(Math.random() * colorsetData.texture.length)];
				} else {
					materialData.texture = colorsetData.texture;
				}
			} else {
				materialData.texture = appearance.texture;
			}
		}

		//Same for material
		if(!materialData.material){
			let baseTexture = Array.isArray(materialData.texture) ? materialData.texture[0]:materialData.texture;

			if(appearance.material == "auto" || appearance.material == ""){
				if(colorsetData.material)
					materialData.material = colorsetData.material;
				else
					materialData.material = baseTexture.material;
			} else {
				materialData.material = appearance.material;
			}
		}

		//for font, we priorize the dicepreset font, then custom, then coloret
		if(appearance.font == "auto"){
			if(diceobj.font){
				materialData.font = diceobj.font;
			} else {
				materialData.font = colorsetData.font;
			}
		} else {
			materialData.font = appearance.font;
		}

		if(appearance.fontScale)
			materialData.fontScale = appearance.fontScale;
		else if(diceobj.fontScale){
			materialData.fontScale = diceobj.fontScale;
		} else {
			materialData.fontScale = colorsetData.fontScale;
		}

		materialData.isGhost = appearance.isGhost?appearance.isGhost:false;
		materialData.emissiveLabels = !!colorsetData.emissiveLabels;
		materialData.labelComposite = colorsetData.labelComposite || 'source-over';
		materialData.backgroundComposite = colorsetData.backgroundComposite || 'source-over';

		//colorset can override its texture's blend mode. the damage-type mapping bakes the colorset into
		//appearance (leaving appearance.colorset unset), so also read it from appearance
		const textureComposite = colorsetData.textureComposite || appearance.textureComposite;
		if(textureComposite && materialData.texture?.name && materialData.texture.name !== "none"){
			materialData.texture = Object.assign({}, materialData.texture, { composite: textureComposite });
		}

		//per-face overrides from dice library
		if(appearance.libraryDieId) {
			let libraryDie = null;
			if(appearance.libraryDieOwner) {
				const owner = game.users.get(appearance.libraryDieOwner);
				if(owner) {
					libraryDie = DiceLibrary.getFromUser(owner, appearance.libraryDieId);
				}
			} else if(diceLibrary) {
				libraryDie = Array.isArray(diceLibrary)
					? diceLibrary.find(d => d.id === appearance.libraryDieId)
					: null;
			}
			if(libraryDie) {
				//library die overrides the entire appearance
				const base = libraryDie.baseAppearance || {};
				materialData.background = base.diceColor || "#000000";
				materialData.foreground = base.labelColor || "#FFFFFF";
				materialData.outline = base.outlineColor || "";
				materialData.edge = base.edgeColor || "";
				materialData.font = (base.font && base.font !== "auto") ? base.font : colorsetData.font;
				materialData.texture = DiceColors.getTexture(base.texture || "none");
				if (base.textureComposite && materialData.texture.name) {
					materialData.texture = Object.assign({}, materialData.texture, { composite: base.textureComposite });
				}
				if (base.material && base.material !== "auto") {
					materialData.material = base.material;
				} else {
					//derive material from texture (e.g. bronze => metal)
					let libBaseTexture = Array.isArray(materialData.texture) ? materialData.texture[0] : materialData.texture;
					materialData.material = (libBaseTexture && libBaseTexture.material) ? libBaseTexture.material : "plastic";
				}

				materialData.perFaceOverrides = {};
				if(!materialData.isGhost) {
					for(const [faceValue, faceData] of Object.entries(libraryDie.faces || {})) {
						if(!faceData) continue;
						const override = {};
						if(faceData.foreground !== null && faceData.foreground !== undefined) override.foreground = faceData.foreground;
						if(faceData.background !== null && faceData.background !== undefined) override.background = faceData.background;
						if(faceData.outline !== null && faceData.outline !== undefined) override.outline = faceData.outline;
						if(faceData.font !== null && faceData.font !== undefined) override.font = faceData.font;
						if(faceData.labelText !== null && faceData.labelText !== undefined) override.labelText = faceData.labelText;
						if(faceData.labelImage !== null && faceData.labelImage !== undefined) {
							override.labelImage = faceData.labelImage;
							const loadedImg = DiceLibrary.getLoadedImage(faceData.labelImage);
							if(loadedImg) {
								override.labelImageObj = loadedImg;
								override.labelImageScale = faceData.labelImageScale ?? 100;
								override.labelImageFlip = !!faceData.labelImageFlip;
								override.labelImagePosition = faceData.labelImagePosition ?? 50;
							}
						}
						if(faceData.backgroundTexture !== null && faceData.backgroundTexture !== undefined) {
							override.texture = DiceColors.getTexture(faceData.backgroundTexture);
							if (faceData.backgroundTextureComposite && override.texture.name) {
								override.texture = Object.assign({}, override.texture, { composite: faceData.backgroundTextureComposite });
							}
						}
						if(faceData.emissive === true) override.emissive = true;
						else if(faceData.emissive === false) override.emissive = false;
						if(faceData.fontScale !== null && faceData.fontScale !== undefined) override.fontScale = faceData.fontScale;
						if(Object.keys(override).length > 0) {
							materialData.perFaceOverrides[faceValue] = override;
						}
					}
				}
				materialData.libraryDieId = appearance.libraryDieId;
				materialData.libraryDieUpdatedAt = libraryDie.updatedAt || "";
				if(libraryDie.baseAppearance?.emissive) {
					materialData.baseEmissive = true;
				}
			}
		}

		let cacheExtra = materialData.libraryDieId ? (appearance.libraryDieOwner || "") + materialData.libraryDieId + materialData.libraryDieUpdatedAt : "";
		materialData.cacheString = appearance.system+materialData.background+materialData.foreground+materialData.outline+materialData.texture.name+(materialData.texture.composite||'')+materialData.edge+materialData.material+materialData.font+materialData.isGhost+materialData.emissiveLabels+materialData.labelComposite+materialData.backgroundComposite+cacheExtra;
		return materialData;
	}

	calc_texture_size(approx, ceil = false) {
		let size = 0;
		if(!ceil)
			size = Math.pow(2, Math.floor(Math.log(approx) / Math.log(2)));
		else
			size = Math.pow(2, Math.ceil(Math.log(approx) / Math.log(2)));
		return size;
	}

	async createGeometry(type, typeScale, scopedScale) {
		const geometryTypes = [
			'd2', 'd4', 'd6', 'd8', 'd10', 'd12', 'd14', 'd16', 'd20', 'd24', 'd30'
		];
	
		if (!geometryTypes.includes(type)) {
			throw new Error(`Invalid geometry type: ${type}`);
		}
	
		return this.loadGeometry(type, scopedScale);
	}
	
	loadGeometry(type, scopedScale) {
		const loader = new BufferGeometryLoader();
		const bufferGeometry = loader.parse(DICE_MODELS[type]);
		//raw vertices are ~100 units per edge, normalize to unit then scale
		const k = scopedScale / 100;
		bufferGeometry.scale(k, k, k);

		//cannon-es Cylinder axis is Y; d2 geometry has its flat faces along Z
		//https://github.com/pmndrs/cannon-es/pull/30
		if (type === 'd2')
			bufferGeometry.rotateX(Math.PI / 2);

		return bufferGeometry;
	}
}
