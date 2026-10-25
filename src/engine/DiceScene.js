// Modified by ccf-web (2026-10-12) from Dice So Nice 6.2.9 (AGPL-3.0): asset URLs made absolute (/modules/dice-so-nice/...);
// (2026-10-25) high-DPI rendering capped at 1.5x the CSS pixels (MAX_PIXEL_RATIO).
import {
	ACESFilmicToneMapping,
	Timer,
	Color,
	CubeTextureLoader,
	DirectionalLight,
	FloatType,
	HalfFloatType,
	LinearFilter,
	NoColorSpace,
	HemisphereLight,
	Layers,
	Mesh,
	MeshBasicMaterial,
	PCFShadowMap,
	PerspectiveCamera,
	PlaneGeometry,
	PMREMGenerator,
	Raycaster,
	Scene,
	ShaderMaterial,
	ShadowMaterial,
	SRGBColorSpace,
	TextureLoader,
	Vector2,
	Vector3,
	WebGLRenderer,
	WebGLRenderTarget
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { LEGACY_TO_METERS } from './SceneConstants.js';

//shared rendering foundation: scene, renderer, camera, lighting, shadow plane, display
// ccf-web: the most the dice canvas renders per CSS pixel (see the high-DPI setPixelRatio).
const MAX_PIXEL_RATIO = 1.5;

export class DiceScene {

	constructor(container, diceFactory, config) {
		this.container = container;
		this.dicefactory = diceFactory;
		this.config = config;

		this.raycaster = new Raycaster();

		this.display = {
			currentWidth: null,
			currentHeight: null,
			containerWidth: null,
			containerHeight: null,
			innerWidth: null,
			innerHeight: null,
			aspect: null,
			scale: null
		};

		this.cameraHeight = {
			max: null,
			close: null,
			medium: null,
			far: null
		};

		this.timer = new Timer();

		this.colors = {
			ambient: 0xf0f0f0,
			spotlight: 0xffd7a0,
			ground: 0x080820
		};

		this.renderer = null;
		this.camera = null;
		this.light = null;
		this.light_amb = null;
		this.light_rect = null;
		this.desk = null;
		this.scene = null;
		this.anisotropy = null;

		this.toneMappingExposureDefault = 1.0;

		//set by consumers to delegate the actual render call (e.g. bloom pipeline)
		this.compositorRender = null;

		//set by consumers when animated dice are present (skips mixer updates when false)
		this.animatedDiceDetected = false;
	}

	initialize() {
		return new Promise(async resolve => {
			this.scene = new Scene();
			const cacheKey = this.config.rendererCacheKey;

			if (game.dice3d.dice3dRenderers[cacheKey] != null) {
				this.renderer = game.dice3d.dice3dRenderers[cacheKey];
				this.scene.environment = this.renderer.scopedTextureCache.textureCube;
				this.scene.traverse(object => {
					if (object.type === 'Mesh') object.material.needsUpdate = true;
				});
			}
			else {
				const preserveDrawingBuffer = game.user.getFlag("dice-so-nice", "preserveDrawingBuffer") || false;
				this.renderer = new WebGLRenderer({
					antialias: !!this.dicefactory.advancedGlass,
					alpha: true,
					powerPreference: "high-performance",
					preserveDrawingBuffer: preserveDrawingBuffer,
					logarithmicDepthBuffer: true
				});
				// ccf-web: capped, so a 4K / 200% screen doesn't render the full-window scene at 4x the pixels.
				if (this.dicefactory.useHighDPI)
					this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
				if (this.dicefactory.realisticLighting) {
					this.renderer.toneMapping = ACESFilmicToneMapping;
					this.renderer.toneMappingExposure = this.toneMappingExposureDefault;
				}
				const capabilities = this.renderer.capabilities;
				this.anisotropy = capabilities.getMaxAnisotropy() < 16 ? capabilities.getMaxAnisotropy() : 16;
				await this.loadContextScopedTextures(cacheKey);
				this.dicefactory.initializeMaterials();
				game.dice3d.dice3dRenderers[cacheKey] = this.renderer;
			}

			this.container.appendChild(this.renderer.domElement);
			this.renderer.shadowMap.enabled = this.dicefactory.shadows;
			this.renderer.shadowMap.type = PCFShadowMap;
			this.renderer.setClearColor(0x000000, 0.0);

			this.setScene(this.config.dimensions);

			resolve();
		});
	}

	loadContextScopedTextures(type) {
		return new Promise(resolve => {
			this.renderer.scopedTextureCache = { type: type };
			if (this.dicefactory.realisticLighting) {

				this._loadPbrAtlas().then(() => {
					this.pmremGenerator = new PMREMGenerator(this.renderer);
					this.pmremGenerator.compileEquirectangularShader();

					new HDRLoader()
						.setDataType(HalfFloatType)
						.setPath('/modules/dice-so-nice/textures/equirectangular/')
						.load(this.dicefactory.ambiance + '.hdr', function (texture) {
							this.renderer.scopedTextureCache.textureCube = this.pmremGenerator.fromEquirectangular(texture).texture;
							this.renderer.scopedTextureCache.textureCube.colorSpace = SRGBColorSpace;
							this.scene.environment = this.renderer.scopedTextureCache.textureCube;
							texture.dispose();
							this.pmremGenerator.dispose();
							resolve();
						}.bind(this));
				}).catch(e => {
					console.error('Dice So Nice | PBR texture load failed completely', e);
					resolve();
				});
			} else {
				let loader = new CubeTextureLoader();
				loader.setPath('/modules/dice-so-nice/textures/cubemap/');

				this.renderer.scopedTextureCache.textureCube = loader.load([
					'px.webp', 'nx.webp',
					'py.webp', 'ny.webp',
					'pz.webp', 'nz.webp'
				]);
				resolve();
			}
		});
	}

	async _loadPbrAtlas() {
		const cache = this.renderer.scopedTextureCache;
		try {
			const response = await fetch('/modules/dice-so-nice/textures/pbr-maps.json');
			if (!response.ok) throw new Error(`HTTP ${response.status} loading pbr-maps.json`);
			const manifest = await response.json();
			const atlasW = manifest.meta.size.w;
			const atlasH = manifest.meta.size.h;

			const atlasTexture = await new Promise((resolve, reject) => {
				new TextureLoader().load(
					`/modules/dice-so-nice/textures/${manifest.meta.image}`,
					resolve, undefined, reject
				);
			});
			atlasTexture.generateMipmaps = false;
			atlasTexture.minFilter = LinearFilter;
			atlasTexture.colorSpace = NoColorSpace;

			cache._atlasFrames = {};

			for (const [frameKey, frameData] of Object.entries(manifest.frames)) {
				const key = frameKey.replace(/\.webp$/, '');
				const { x, y, w, h } = frameData.frame;

				const clone = atlasTexture.clone();
				clone.repeat.set(w / atlasW, h / atlasH);
				clone.offset.set(x / atlasW, (atlasH - y - h) / atlasH);
				clone.anisotropy = this.anisotropy;
				cache[key] = clone;
				cache._atlasFrames[key] = { x, y, w, h };
			}
		} catch (e) {
			console.error('Dice So Nice | PBR atlas load failed', e);
		}
	}

	setScene(dimensions) {
		this.display.currentWidth = this.container.clientWidth > 0 ? this.container.clientWidth : parseInt(this.container.style.width);
		this.display.currentHeight = this.container.clientHeight > 0 ? this.container.clientHeight : parseInt(this.container.style.height);

		let containerPxW, containerPxH, marginPx;
		if (dimensions) {
			containerPxW = dimensions.width;
			containerPxH = dimensions.height;
			marginPx = dimensions.margin || null;

			if (!this.display.currentWidth || !this.display.currentHeight) {
				this.display.currentWidth = dimensions.width;
				this.display.currentHeight = dimensions.height;
			}
		} else {
			containerPxW = this.display.currentWidth;
			containerPxH = this.display.currentHeight;
			marginPx = this.display.containerMarginPx || null;
		}

		this.display.containerMarginPx = marginPx;
		this.display.containerWidth = containerPxW * LEGACY_TO_METERS;
		this.display.containerHeight = containerPxH * LEGACY_TO_METERS;
		this.display.containerMargin = marginPx ? {
			top: (marginPx.top || 0) * LEGACY_TO_METERS,
			bottom: (marginPx.bottom || 0) * LEGACY_TO_METERS,
			left: (marginPx.left || 0) * LEGACY_TO_METERS,
			right: (marginPx.right || 0) * LEGACY_TO_METERS
		} : null;

		this.updateInnerDimensions();

		this.display.aspect = Math.min(this.display.currentWidth / containerPxW, this.display.currentHeight / containerPxH);

		this.updateScale(this.config.scale, this.config.autoscale);

		this.renderer.setSize(this.display.currentWidth, this.display.currentHeight);

		const cameraFovDeg = 20;
		this.cameraHeight.max = this.display.containerHeight / this.display.aspect / Math.tan((cameraFovDeg / 2) * Math.PI / 180);

		this.cameraHeight.medium = this.cameraHeight.max / 1.5;
		this.cameraHeight.far = this.cameraHeight.max;
		this.cameraHeight.close = this.cameraHeight.max / 2;

		if (this.camera) this.scene.remove(this.camera);
		this.camera = new PerspectiveCamera(cameraFovDeg, this.display.currentWidth / this.display.currentHeight, 0.01, this.cameraHeight.max * 1.3);

		//camera looks down -Y which is singular for the default up=(0,1,0),
		//so override up to (0,0,-1) for a stable orientation
		this.camera.up.set(0, 0, -1);
		this.camera.position.set(0, this.cameraHeight.far, 0);
		this.camera.lookAt(new Vector3(0, 0, 0));

		const maxwidth = Math.max(this.display.containerWidth / 2, this.display.containerHeight / 2);

		if (this.light) this.scene.remove(this.light);
		if (this.light_amb) this.scene.remove(this.light_amb);
		if (this.light_rect) this.scene.remove(this.light_rect);

		let intensity, intensity_amb;
		if (this.dicefactory.realisticLighting) {
			intensity = 0.1;
			intensity_amb = 1.5;
		} else {
			this.colors.spotlight = 0xffffff;
			this.colors.ambient = 0xffffff;
			intensity = 0.2;
			intensity_amb = 7.0;
		}

		this.light_amb = new HemisphereLight(this.colors.ambient, this.colors.ground, intensity_amb);
		this.scene.add(this.light_amb);

		this.light = new DirectionalLight(this.colors.spotlight, intensity);
		this.light.position.set(-this.display.containerWidth / 20, maxwidth * 2, -this.display.containerHeight / 20);
		this.light.target.position.set(0, 0, 0);
		this.light.distance = 0;
		this.light.castShadow = this.dicefactory.shadows;
		this.light.shadow.camera.up.set(0, 0, -1);
		this.light.shadow.camera.near = maxwidth / 10;
		this.light.shadow.camera.far = maxwidth * 5;
		this.light.shadow.camera.fov = 50;
		this.light.shadow.bias = -0.00005;
		const shadowMapSize = { high: 4096, medium: 2048, low: 1024 }[this.dicefactory.shadowQuality] || 1024;
		this.light.shadow.mapSize.width = shadowMapSize;
		this.light.shadow.mapSize.height = shadowMapSize;

		const halfWidth  = this.display.containerWidth  / 2;
		const halfHeight = this.display.containerHeight / 2;
		const margin = 2.0;
		this.light.shadow.camera.left   = -halfWidth  * margin;
		this.light.shadow.camera.right  =  halfWidth  * margin;
		this.light.shadow.camera.top    =  halfHeight * margin;
		this.light.shadow.camera.bottom = -halfHeight * margin;
		this.scene.add(this.light);

		if (this.desk)
			this.scene.remove(this.desk);

		let shadowplane = new ShadowMaterial();
		shadowplane.opacity = 0.5;
		shadowplane.depthWrite = false;
		//PlaneGeometry defaults to XY, rotate to XZ so it lies flat
		this.desk = new Mesh(new PlaneGeometry(this.display.containerWidth * 3, this.display.containerHeight * 3, 1, 1), shadowplane);
		this.desk.receiveShadow = this.dicefactory.shadows;
		this.desk.rotation.x = -Math.PI / 2;
		this.desk.position.set(0, 0, 0);
		this.scene.add(this.desk);

		this.renderScene();
	}

	renderScene() {
		//update animated dice mixers
		if (this.animatedDiceDetected) {
			let animatedMaterials = new Set();
			this.timer.update();
			let delta = this.timer.getDelta();

			this.scene.traverse(obj => {
				if(obj.mixer)
					obj.mixer.update(delta);
				if(obj.material?.mixer)
					animatedMaterials.add(obj.material);
			});

			for (const material of animatedMaterials) {
				material.mixer.update(delta);
			}
		}

		//update time uniform
		game.dice3d.uniforms.time.value = performance.now() / 1000;

		//delegate to compositor if set, otherwise direct render
		if (this.compositorRender) {
			this.compositorRender();
		} else {
			this.renderer.render(this.scene, this.camera);
		}
	}

	clearScene() {
		while (this.scene.children.length > 0) {
			this.scene.remove(this.scene.children[0]);
		}
		this.desk.material.dispose();
		this.desk.geometry.dispose();
		if (this.dicefactory.shadows) {
			this.light.shadow.map.dispose();
		}
		this._disposeBloomPipeline();
	}

	updateBoundaries(dimensions) {
		const prevPxW = this.display.containerWidth / LEGACY_TO_METERS;
		const prevPxH = this.display.containerHeight / LEGACY_TO_METERS;
		const prevMarginPx = this.display.containerMarginPx || { top:0, bottom:0, left:0, right:0 };

		const newPxDimensions = {
			width: dimensions.width ?? prevPxW,
			height: dimensions.height ?? prevPxH,
			margin: {
				top: dimensions.margin?.top ?? prevMarginPx.top ?? 0,
				bottom: dimensions.margin?.bottom ?? prevMarginPx.bottom ?? 0,
				left: dimensions.margin?.left ?? prevMarginPx.left ?? 0,
				right: dimensions.margin?.right ?? prevMarginPx.right ?? 0
			}
		};

		this.display.containerMarginPx = newPxDimensions.margin;
		this.display.containerWidth = newPxDimensions.width * LEGACY_TO_METERS;
		this.display.containerHeight = newPxDimensions.height * LEGACY_TO_METERS;
		this.display.containerMargin = {
			top: newPxDimensions.margin.top * LEGACY_TO_METERS,
			bottom: newPxDimensions.margin.bottom * LEGACY_TO_METERS,
			left: newPxDimensions.margin.left * LEGACY_TO_METERS,
			right: newPxDimensions.margin.right * LEGACY_TO_METERS
		};

		this.updateInnerDimensions();
		this.updateScale(this.config.scale, this.config.autoscale);

		return {
			width: this.display.containerWidth,
			height: this.display.containerHeight,
			margin: this.display.containerMargin
		};
	}

	//update shadow and renderer quality after dicefactory settings change
	updateRenderSettings() {
		this.renderer.shadowMap.enabled = this.dicefactory.shadows;
		this.renderer.shadowMap.type = PCFShadowMap;
		this.light.castShadow = this.dicefactory.shadows;
		this.desk.receiveShadow = this.dicefactory.shadows;
	}

	//set up bloom, gamma correction, and AA post-processing pipeline
	//consumers call this after initialize(). board adds outline pass on top.
	setupBloomPipeline() {
		if (!this.dicefactory.realisticLighting) return;

		this._bloomBlackColor = new Color(0, 0, 0);
		this._bloomDarkMaterial = new MeshBasicMaterial({ color: 'black' });
		this._bloomMaterials = {};
		this._bloomLayer = new Layers();
		this._bloomLayer.set(1);

		let renderScene = new RenderPass(this.scene, this.camera);
		const canvasSize = new Vector2(this.display.currentWidth, this.display.currentHeight);
		this.bloomPass = new UnrealBloomPass(canvasSize, game.dice3d.uniforms.bloomStrength.value, game.dice3d.uniforms.bloomRadius.value, game.dice3d.uniforms.bloomThreshold.value);

		this.gammaPass = new ShaderPass(
			new ShaderMaterial({
				name: 'GammaCorrectionWithAlphaFixShader',
				uniforms: {
					tDiffuse: { value: null }
				},
				vertexShader: /* glsl */`
					varying vec2 vUv;
					void main() {
						vUv = uv;
						gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
					}`,
				fragmentShader: /* glsl */`
					uniform sampler2D tDiffuse;
					varying vec2 vUv;
					void main() {
						vec4 tex = texture2D( tDiffuse, vUv );
						gl_FragColor = sRGBTransferOETF( tex );
						gl_FragColor.a = max( gl_FragColor.a, max( gl_FragColor.r, max( gl_FragColor.g, gl_FragColor.b ) ) );
					}`
			})
		);

		let size = canvasSize.multiplyScalar(this.renderer.getPixelRatio());
		let options = {
			type: game.canvas.app.renderer.context.extensions.floatTextureLinear ? FloatType : HalfFloatType,
			samples: this.dicefactory.aa == "msaa" ? 4 : 0,
			anisotropy: this.anisotropy
		};
		if (navigator.userAgent.indexOf('Mac OS X') != -1 && navigator.userAgent.indexOf('Chrome') != -1) {
			options.stencilBuffer = true;
		}
		this.composerTarget = new WebGLRenderTarget(size.x, size.y, options);

		this.bloomComposer = new EffectComposer(this.renderer, this.composerTarget);
		this.bloomComposer.renderToScreen = false;
		this.bloomComposer.addPass(renderScene);
		this.bloomComposer.addPass(this.bloomPass);

		this.blendingPass = new ShaderPass(
			new ShaderMaterial({
				uniforms: {
					baseTexture: { value: null },
					bloomTexture: { value: this.bloomComposer.renderTarget2.texture },
				},
				vertexShader: /* glsl */`
					varying vec2 vUv;
					void main() {
						vUv = uv;
						gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
					}
				`,
				fragmentShader: /* glsl */`
					uniform sampler2D baseTexture;
					uniform sampler2D bloomTexture;
					varying vec2 vUv;
					void main() {
						vec4 base_color = texture2D(baseTexture, vUv);
						vec4 bloom_color = texture2D(bloomTexture, vUv);

						float lum = 0.21 * bloom_color.r + 0.71 * bloom_color.g + 0.07 * bloom_color.b;
						gl_FragColor = vec4(base_color.rgb + bloom_color.rgb, max(base_color.a, lum));
					}
				`,
				defines: {}
			}), "baseTexture"
		);
		this.blendingPass.needsSwap = true;

		this.finalComposer = new EffectComposer(this.renderer, this.composerTarget);
		this.finalComposer.addPass(renderScene);
		this.finalComposer.addPass(this.blendingPass);

		if (this.dicefactory.aa == "smaa") {
			this.AAPass = new SMAAPass();
			this.AAPass.renderToScreen = true;
			this.finalComposer.addPass(this.AAPass);
		}

		this.finalComposer.addPass(this.gammaPass);

		//set the compositor render delegate
		this.compositorRender = () => {
			game.dice3d.uniforms.globalBloom.value = 1;
			if (!this.finalComposer) return;

			let hasEmissive = false;
			let black = this._bloomBlackColor;
			this.scene.traverseVisible(function (object) {
				if (object.material && object.material.emissive != undefined && !object.material.emissive.equals(black)) {
					hasEmissive = true;
					return;
				}
			});
			if (hasEmissive && this.dicefactory.glow) {
				this.scene.traverseVisible(this._darkenNonBloomed.bind(this));
				this.bloomComposer.render();
				this.scene.traverseVisible(this._restoreMaterial.bind(this));
				this.blendingPass.enabled = true;
			} else {
				this.blendingPass.enabled = false;
			}
			game.dice3d.uniforms.globalBloom.value = 0;
			this.finalComposer.render();
		};
	}

	_darkenNonBloomed(obj) {
		if (obj.isMesh && this._bloomLayer.test(obj.layers) === false) {
			this._bloomMaterials[obj.uuid] = obj.material;
			obj.material = this._bloomDarkMaterial;
		}
	}

	_restoreMaterial(obj) {
		if (this._bloomMaterials[obj.uuid]) {
			obj.material = this._bloomMaterials[obj.uuid];
			delete this._bloomMaterials[obj.uuid];
		}
	}

	_disposeBloomPipeline() {
		if (this.composerTarget)
			this.composerTarget.dispose();
		if (this.bloomPass)
			this.bloomPass.dispose();
		if (this.AAPass)
			this.AAPass.dispose();
		if (this.bloomComposer) {
			this.bloomComposer.renderTarget1.dispose();
			this.bloomComposer.renderTarget2.dispose();
		}
		if (this.finalComposer) {
			this.finalComposer.renderTarget1.dispose();
			this.finalComposer.renderTarget2.dispose();
		}
		this.compositorRender = null;
	}

	updateScale(scale = 100, autoscale = false) {
		this.config.autoscale = autoscale;
		this.config.scale = scale;
		if (autoscale) {
			this.display.scale = this.computeAutoScale();
		} else {
			const autoScaleReference = this.computeAutoScale();
			const BASE = 75;
			const pct = Math.min(100, Math.max(0, scale));
			const normalizedScale = autoScaleReference * (pct / BASE) || 1;
			this.display.scale = normalizedScale;
		}
	}

	computeAutoScale() {
		const w = this.display.containerWidth;
		const h = this.display.containerHeight;
		return Math.sqrt(w * w + h * h) / 13;
	}

	updateInnerDimensions() {
		const m = this.display.containerMargin || { top:0,bottom:0,left:0,right:0 };
		this.display.innerWidth = Math.max(0, this.display.containerWidth - (m.left||0) - (m.right||0));
		this.display.innerHeight = Math.max(0, this.display.containerHeight - (m.top||0) - (m.bottom||0));
		if (!this.display.innerWidth) this.display.innerWidth = this.display.containerWidth;
		if (!this.display.innerHeight) this.display.innerHeight = this.display.containerHeight;
	}
}
