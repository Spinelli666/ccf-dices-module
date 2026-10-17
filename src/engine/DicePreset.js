import { Group } from 'three';
import { ShaderUtils } from './ShaderUtils';
import { AssetsLoader } from '../AssetsLoader.js';

//d4 row 0 vertex values (1-based): each triplet is the 3 vertex values shown on
//one orientation of the d4 face. rows 1-3 of the tab in registerFaces() are
//hand-written symmetries of this row. DiceFactory imports this to do per-vertex
//override lookups during the draw loop.
export const D4_TRIPLET_VALUES = [[2,4,3],[1,3,4],[2,1,4],[1,2,3]];

export class DicePreset {

	constructor(type, shape = '') {

		shape = shape || type;

		this.type = type;
		this.term = 'Die';
		this.shape = shape || type;
		this.scale = 1;
		this.scaleModifier = 1;
		this.labels = [];
		this.valueMap = null;
		this.values = [];
		this.bumps = [];
		this.emissiveMaps = [];
		this.emissive = 0x000000;
		this.emissiveIntensity = 1;
		this.mass = 300;
		this.inertia = 13;
		this.geometry = null;
		this.model = null;
		this.system = 'standard';
		this._diceSystem = null;
		this.modelLoaded = false;
		this.modelLoading = false;
		this.modelFile = null;
		this.internalAdd = false;
		this.atlas = null;

		//todo : check if this is useful
		this.appearance = {
			labelColor: "#FFFFFF",
			diceColor: "#000000",
			outlineColor: "#000000",
			edgeColor: "#000000",
			texture: "none",
			material: "auto",
			font: "auto",
			colorset: "custom"
		};
	}

	set diceSystem(system) {
		this._diceSystem = system;
	}

	get diceSystem() {
		return this._diceSystem;
	}

	get systemSettings() {
		return this.diceSystem.getSettingsByDiceType(this.type);
	}

	setValues(min = 1, max = 20, step = 1) {
		this.values = this.range(min, max, step);
		if (min < 1)
			this.setValueMap(min, max, step);
	}

	setValueMap(min, max, step) {
		let map = {};
		let count = 1;
		for (let i = min; i <= max; i += step) {
			map[i] = count;
			count++;
		}
		this.valueMap = map;
	}

	registerFaces(faces) {
		// Faces is an object with keys: 'labels', 'bumps', and 'emissiveMaps'
		// Each key points to another object with keys as the texture names and values as the loaded textures
		if (this.shape == 'd4') this._d4Sources = {};
		for (let type of ['labels', 'bumps', 'emissiveMaps']) {
			if (faces[type] && Object.keys(faces[type]).length > 0) {
				let tab = [];

				if (this.shape == 'd4') {
					// For d4, specific layout is needed
					const textures = Object.values(faces[type]); // Convert object to array of textures
					let a = textures[0];
					let b = textures[1];
					let c = textures[2];
					let d = textures[3];
					//keep identity refs so per-value library overrides can swap a/b/c/d at render time
					this._d4Sources[type] = [a, b, c, d];
					let background = [];
					if (faces.backgrounds?.[type]) {
						for (let i=0; i<4; i++) {
							if (faces.backgrounds[type][i])
								background.push(faces.backgrounds[type][i]);
						}
					}

					//row 0 is generated from D4_TRIPLET_VALUES so DiceFactory and DicePreset
					//cannot drift. rows 1-3 are hand-written symmetries (different vertex
					//orderings that swapDiceFace picks between based on which face lands up).
					const d4Sources = [a, b, c, d];
					const row0Triplets = D4_TRIPLET_VALUES.map(t => t.map(v => d4Sources[v - 1]));
					tab = [
						[background, [0, 0, 0], ...row0Triplets],
						[background, [0, 0, 0], [b, c, d], [c, a, d], [b, d, a], [c, b, a]],
						[background, [0, 0, 0], [d, c, b], [c, d, a], [d, b, a], [c, a, b]],
						[background, [0, 0, 0], [d, b, c], [a, d, c], [d, a, b], [a, c, b]]
					];
				} else {
					if (faces.backgrounds?.[type]) {
						tab.push(faces.backgrounds[type]);
					} else {
						tab.push(''); //No one knows anymore why we need an empty line
					}
					if (!["d2", "d10"].includes(this.shape)) tab.push(''); //But even less people know why we need two empty lines except for d2 and d10

					// For other shapes, just flatten the object values into an array
					tab.push(...Object.values(faces[type]));
				}

				// Assign the prepared tab array to the corresponding property of the object
				switch (type) {
					case "labels":
						this.labels = tab;
						break;
					case "bumps":
						this.bumps = tab;
						break;
					case "emissiveMaps":
						this.emissiveMaps = tab;
						break;
				}
			}
		}
	}
	

	setLabels(labels) {
		this.labels = labels;
		this.unloadModel();
	}

	setBumpMaps(bumps) {
		this.bumps = bumps;
		this.unloadModel();
	}

	setEmissiveMaps(emissiveMaps) {
		this.emissiveMaps = emissiveMaps;
		this.unloadModel();
	}

	setBackgrounds(backgrounds) {
		this.backgrounds = backgrounds;
		this.unloadModel();
	}

	setAtlas(atlas) {
		this.atlas = atlas;
		this.unloadModel();
	}

	unloadModel() {
		this.modelLoaded = false;
		this.modelLoading = false;
	}

	loadTextures() {
        if (!this.modelLoaded && this.modelLoading === false) {
            this.modelLoading = new Promise(async (resolve, reject) => {
                try {
                    const assetsLoader = new AssetsLoader();
                    let allTextures = {};

                    if (this.atlas) {
                        // Load the atlas, which will be checked first for each texture.
                        let loadedAtlasTextures = await assetsLoader.load(this.atlas);
						loadedAtlasTextures = loadedAtlasTextures[this.atlas];

                        // Process each texture type, attempting to use the atlas first, then falling back to URLs.
                        allTextures['labels'] = await this.loadTextureType(this.labels, loadedAtlasTextures, assetsLoader);
                        if (this.bumps) {
                            allTextures['bumps'] = await this.loadTextureType(this.bumps, loadedAtlasTextures, assetsLoader);
                        }
                        if (this.emissiveMaps) {
                            allTextures['emissiveMaps'] = await this.loadTextureType(this.emissiveMaps, loadedAtlasTextures, assetsLoader);
                        }
						if (this.backgrounds) {
							allTextures['backgrounds'] = {};
							if (this.backgrounds.labels) {
								allTextures.backgrounds.labels = await this.loadTextureType(this.backgrounds.labels, loadedAtlasTextures, assetsLoader);
							}
							if (this.backgrounds.bumpMaps) {
								allTextures.backgrounds.bumps = await this.loadTextureType(this.backgrounds.bumpMaps, loadedAtlasTextures, assetsLoader);
							}
							if (this.backgrounds.emissiveMaps) {
								allTextures.backgrounds.emissiveMaps = await this.loadTextureType(this.backgrounds.emissiveMaps, loadedAtlasTextures, assetsLoader);
							}
                        }
                    } else {
                        // Load each texture type from URLs as no atlas is specified.
                        allTextures['labels'] = await this.loadTextureType(this.labels, {}, assetsLoader);
                        if (this.bumps) {
                            allTextures['bumps'] = await this.loadTextureType(this.bumps, {}, assetsLoader);
                        }
                        if (this.emissiveMaps) {
                            allTextures['emissiveMaps'] = await this.loadTextureType(this.emissiveMaps, {}, assetsLoader);
                        }
						if (this.backgrounds) {
							allTextures['backgrounds'] = {};
							if (this.backgrounds.labels) {
								allTextures.backgrounds.labels = await this.loadTextureType(this.backgrounds.labels, {}, assetsLoader);
							}
							if (this.backgrounds.bumpMaps) {
								allTextures.backgrounds.bumps = await this.loadTextureType(this.backgrounds.bumpMaps, {}, assetsLoader);
							}
							if (this.backgrounds.emissiveMaps) {
								allTextures.backgrounds.emissiveMaps = await this.loadTextureType(this.backgrounds.emissiveMaps, {}, assetsLoader);
							}
                        }
                    }

                    // Register textures based on type.
                    this.registerFaces(allTextures);

                    this.modelLoaded = true;
                    resolve();
                } catch (error) {
                    console.error("[Dice So Nice] Error loading textures:", error);
                    reject(error);
                }
            });
        }
        return this.modelLoading;
    }

    // Helper function to load textures by type, checking the atlas first, then falling back to direct URLs.
    async loadTextureType(textureList, loadedAtlasTextures, assetsLoader) {
		//accept plain objects too: callers sometimes pass {key1: url, key2: url}
		//instead of an array, and silently dropping those entries has burned us.
		if (textureList && !Array.isArray(textureList)) {
			textureList = Object.values(textureList);
		}
		const textureMap = [];
		const imageRegex = /\.(png|jpg|jpeg|gif|webp)$/i;

		for (let i = 0; i < textureList.length; i++) {
			const texture = textureList[i];
	
			if (!texture || !texture.match(imageRegex)) {
				// If the entry is not an image, handle it as a string directly.
				textureMap[i] = texture;
			} else if (loadedAtlasTextures[texture]) {
				// If the texture is found in the atlas (without the file extension)
				textureMap[i] = loadedAtlasTextures[texture];
			} else {
				// If the texture is not found in the atlas, try to load from the URL
				const loadedTexture = await assetsLoader.load([texture]);
				// Extract the texture directly from the returned object, assuming it has been flattened
				textureMap[i] = loadedTexture[texture];
			}
		}
		return textureMap;
	}
	

	range(start, stop, step = 1) {
		var a = [start], b = start;
		while (b < stop) {
			a.push(b += step || 1);
		}
		return a;
	}

	setModel(file) {
		this.modelFile = file;
		this.modelLoaded = false;
	}

	//loader is a GLTFLoader instance
	loadModel(loader = null) {
		// Load a glTF resource
		if (!this.modelLoaded && this.modelLoading === false) {
			this.modelLoading = new Promise((resolve, reject) => {
				loader.load(this.modelFile, gltf => {
					gltf.scene.traverse(function (node) {
						if (node.isMesh) {
							if (node.userData && node.userData.hasOwnProperty('castShadow'))
								node.castShadow = node.userData.castShadow;
							else
								node.castShadow = true;
							node.material.onBeforeCompile = ShaderUtils.applyDiceSoNiceShader;
							const anisotropy = game.dice3d.box.anisotropy;
							if (node.material.map !== null)
								node.material.map.anisotropy = anisotropy;

							if (node.material.normalMap !== null)
								node.material.normalMap.anisotropy = anisotropy;

							if (node.material.emissiveMap !== null)
								node.material.emissiveMap.anisotropy = anisotropy;

							if (node.material.roughnessMap !== null)
								node.material.roughnessMap.anisotropy = anisotropy;

							if (node.material.metalnessMap !== null)
								node.material.metalnessMap.anisotropy = anisotropy;
							node.layers.enableAll();

							//deprecated shader hook
							Hooks.callAll("diceSoNiceOnMaterialReady", node.material, null);
						}
					});
					//cannon-es Cylinder axis is Y; d2 models author flat faces along Z
					if (this.shape === 'd2') {
						const root = gltf.scene.children[0];
						if (root.children.length) {
							const orientationGroup = new Group();
							orientationGroup.rotation.x = Math.PI / 2;
							while (root.children.length)
								orientationGroup.add(root.children[0]);
							root.add(orientationGroup);
						}
						//single-mesh export with geometry on the root node: no child to wrap,
						//so the vertex rotation is the right orientation for it
						if (root.isMesh && root.geometry)
							root.geometry.rotateX(Math.PI / 2);
					}

					this.model = gltf;
					this.modelLoaded = true;
					Hooks.callAll("diceSoNiceModelLoaded", this);
					resolve(gltf);
				});
			});
		}
		return this.modelLoading;
	}
}