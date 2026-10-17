// Modified by ccf-web (2026-10-12) from Dice So Nice 6.2.9 (AGPL-3.0): asset URLs made absolute (/modules/dice-so-nice/...).
import { Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
import { DiceSFX } from './DiceSFX.js';
import { DiceSFXManager } from './DiceSFXManager.js';
import { LEGACY_TO_METERS } from '../engine/SceneConstants.js';

export class PlayAnimationImpact extends DiceSFX {
    static id = "PlayAnimationImpact";
    static specialEffectName = "DICESONICE.PlayAnimationImpact";
    static sound = "/modules/dice-so-nice/sfx/sounds/hit_glass.mp3";
    static planeImpact = null;
    static duration = 0.1;
     /**@override constructor */
    constructor(box, dicemesh){
        super(box, dicemesh);
        this.enableGC = true;
    }
    /**@override init */
    static async init() {
        game.audio.pending.push(function () {
            foundry.audio.AudioHelper.preloadSound(PlayAnimationImpact.sound);
        }.bind(this));
            
        let data = await this.loadAsset(DiceSFXManager.TextureLoader, "/modules/dice-so-nice/sfx/textures/glassimpact_color.webp");
        const geometry = new PlaneGeometry(730, 730);
        const material = new MeshStandardMaterial({
            map: data,
            transparent: true,
            opacity: 2
        });
        PlayAnimationImpact.planeImpact = new Mesh(geometry, material);
    }

    /**@override play */
    async play() {
        this.plane = PlayAnimationImpact.planeImpact.clone();
        this.plane.receiveShadow = this.box.shadows;

        let scale = this.computeScale();
        this.plane.scale.set(scale, scale, scale);

        this.plane.position.x = this.dicemesh.parent.position.x;
        this.plane.position.z = this.dicemesh.parent.position.z;
        //lay flat on XZ, random spin
        this.plane.rotation.x = -Math.PI / 2;
        this.plane.rotation.z = Math.random() * Math.PI * 2;
        this.box.scene.add(this.plane);
        foundry.audio.AudioHelper.play({
            src: PlayAnimationImpact.sound,
            volume: this.volume
        }, false);
        this.dicemesh.position.y -= LEGACY_TO_METERS;

    }

    destroy() {
        this.box.scene.remove(this.plane);
        this.destroyed = true;
    }
}