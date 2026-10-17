import { Vector2 } from 'three';

export class ShaderUtils {

	static applyDiceSoNiceShader(shader) {

        if(this.emissive !== undefined && game.dice3d.DiceFactory.realisticLighting) {
            ShaderUtils.selectiveBloomShaderFragment(shader);
        }

        // This is the old iridescent shader, which is now deprecated.
        if (this.userData.iridescent) {
            ShaderUtils.iridescentShaderFragment(shader);
        }

        if (shader.shaderName == "MeshPhysicalMaterial" && shader.iridescence) {
            ShaderUtils.iridescenceShaderFragment(shader);
        }

        if (this.userData.advancedGlassMask) {
            ShaderUtils.glassMaskShaderFragment(shader);
        }

        if (this.userData.detailNormalMap) {
            shader.uniforms.detailNormalMap = { value: this.userData.detailNormalMap };
            shader.uniforms.detailNormalScale = { value: this.userData.detailNormalScale ?? 1.0 };
            shader.uniforms.normalMapUvOffset = { value: this.normalMap?.offset ?? new Vector2(0, 0) };
            shader.uniforms.normalMapUvRepeat = { value: this.normalMap?.repeat ?? new Vector2(1, 1) };
            ShaderUtils.normalBlendingShaderFragment(shader);
        }

		// deprecated shader hook
        Hooks.callAll("diceSoNiceShaderOnBeforeCompile", shader, this);

		// new shader hook system
		if(this.userData.system && game.dice3d.DiceFactory.systems.has(this.userData.system)) {
			const system = game.dice3d.DiceFactory.systems.get(this.userData.system);
			system.beforeShaderCompile(shader, this);
		}
    }

	static selectiveBloomShaderFragment(shader) {
		shader.uniforms.globalBloom = game.dice3d.uniforms.globalBloom;
		shader.fragmentShader = /* glsl */`
			uniform float globalBloom;
			${shader.fragmentShader}
		`.replace(
			/* glsl */`#include <dithering_fragment>`,
			/* glsl */`#include <dithering_fragment>
			if (globalBloom > 0.5) {
				#ifdef USE_EMISSIVEMAP
					gl_FragColor.rgb = emissiveColor.rgb * emissive * totalEmissiveRadiance;
				#else
					gl_FragColor.rgb = vec3(0.0);
				#endif
			}
		`
		);
	}

	static iridescenceShaderFragment(shader) {
		// We only need to change the color channel used by the ThreeJS shader for the iridescenceMap from red to blue.
		// This is because we want to use the metallic channel for the iridescenceMap.
		shader.fragmentShader = shader.fragmentShader.replace(/* glsl */`#include <lights_physical_fragment>`,
			/* glsl */`#include <lights_physical_fragment>
				#ifdef USE_IRIDESCENCE
					material.iridescence = iridescence;
					#ifdef USE_IRIDESCENCEMAP
						material.iridescence *= texture2D( iridescenceMap, vUv ).b;
					#endif
				#endif`);
	}
	// This is the old iridescent shader, which is now deprecated.
	static iridescentShaderFragment(shader) {
		shader.uniforms.iridescenceLookUp = game.dice3d.uniforms.iridescenceLookUp;
		shader.uniforms.iridescenceNoise = game.dice3d.uniforms.iridescenceNoise;
		shader.uniforms.boost = game.dice3d.uniforms.boost;

		shader.vertexShader = /* glsl */`
			varying vec3 viWorldPosition;
			varying vec3 viWorldNormal;
			${shader.vertexShader}
		`.replace(
			/* glsl */`#include <fog_vertex>`,
			/* glsl */`#include <fog_vertex>
			viWorldPosition = worldPosition.xyz;
			viWorldNormal = mat3(modelMatrix) * normalize(normal);
			`
		);

		shader.fragmentShader = /* glsl */`
			varying vec3 viWorldPosition;
			varying vec3 viWorldNormal;
			
			uniform sampler2D iridescenceLookUp;
			uniform sampler2D iridescenceNoise;
			uniform float boost;
			${shader.fragmentShader}
		`.replace(
			/* glsl */`#include <transmission_fragment>`,
			/* glsl */`vec3 viewWorldDir = normalize(viWorldPosition - cameraPosition);
			vec3 iNormal = normalize(viWorldNormal); 
			float NdotV = max(-dot(viewWorldDir, iNormal), 0.0);
			float fresnelFactor = pow(1.0 - NdotV, 5.0);
			float noise = texture2D(iridescenceNoise, vUv/2.0).r;
			vec3 airy = texture2D(iridescenceLookUp, vec2(NdotV * .99, noise)).xyz;
			
			if(metalnessFactor >= 1.0) {
				totalSpecular = totalSpecular  * airy * boost;
			}

			#include <transmission_fragment>`
		);
	}

	//advanced glass: inline the transmission_fragment chunk with a contrast curve on
	//the transmissionMap sample. the bump canvas (white bg / grey #555 labels) is
	//bound as transmissionMap, so the curve crushes labels to 0 (solid) while the
	//body stays at 1 (full transmission). everything else matches the stock chunk.
	static glassMaskShaderFragment(shader) {
		shader.fragmentShader = shader.fragmentShader.replace(
			/* glsl */`#include <transmission_fragment>`,
			/* glsl */`#ifdef USE_TRANSMISSION

				material.transmission = transmission;
				material.transmissionAlpha = 1.0;
				material.thickness = thickness;
				material.attenuationDistance = attenuationDistance;
				material.attenuationColor = attenuationColor;

				#ifdef USE_TRANSMISSIONMAP
					material.transmission *= smoothstep( 0.6, 0.9, texture2D( transmissionMap, vTransmissionMapUv ).r );
				#endif

				#ifdef USE_THICKNESSMAP
					material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
				#endif

				vec3 pos = vWorldPosition;
				vec3 v = normalize( cameraPosition - pos );
				vec3 n = inverseTransformDirection( normal, viewMatrix );

				vec4 transmitted = getIBLVolumeRefraction(
					n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
					pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
					material.attenuationColor, material.attenuationDistance );

				material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );

				totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );

			#endif`
		);
	}

	static normalBlendingShaderFragment(shader) {
		shader.fragmentShader = /* glsl */`
			uniform sampler2D detailNormalMap;
			uniform float detailNormalScale;
			uniform vec2 normalMapUvOffset;
			uniform vec2 normalMapUvRepeat;
			${shader.fragmentShader}
		`.replace(
			/* glsl */`#include <normal_fragment_maps>`,
			/* glsl */`#ifdef USE_NORMALMAP_OBJECTSPACE

				normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;

				#ifdef FLIP_SIDED
					normal = - normal;
				#endif

				#ifdef DOUBLE_SIDED
					normal = normal * faceDirection;
				#endif

				normal = normalize( normalMatrix * normal );

			#elif defined( USE_NORMALMAP_TANGENTSPACE )

				vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;

				#if defined( USE_PACKED_NORMALMAP )
					mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
				#endif

				mapN.xy *= normalScale;

				vec2 detailUv = (vNormalMapUv - normalMapUvOffset) / normalMapUvRepeat;
				vec3 detailN = texture2D( detailNormalMap, detailUv ).xyz * 2.0 - 1.0;
				detailN.xy *= detailNormalScale;
				mapN = normalize( vec3( mapN.xy + detailN.xy, mapN.z ) );

				normal = normalize( tbn * mapN );

			#elif defined( USE_BUMPMAP )

				normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );

			#endif`
		);
	}
}