// Modified by ccf-web (2026-10-12) from Dice So Nice 6.2.9 (AGPL-3.0): asset URLs made absolute (/modules/dice-so-nice/...).
import { AdditiveBlending, Box3, Sprite, SpriteMaterial, Vector3 } from 'three';
import { DiceSFX } from './DiceSFX.js';
import { Proton } from '../libs/three.proton.js';
import { DiceSFXManager } from './DiceSFXManager.js';
import { LEGACY_TO_METERS } from '../engine/SceneConstants.js';

export class PlayAnimationParticleSparkles extends DiceSFX {
    static id = "PlayAnimationParticleSparkles";
    static specialEffectName = "DICESONICE.PlayAnimationParticleSparkles";
    static sprite = null;
    static sound = "/modules/dice-so-nice/sfx/sounds/sparkles.mp3";
    /**@override init */
    static async init() {
        let map = await this.loadAsset(DiceSFXManager.TextureLoader, "/modules/dice-so-nice/sfx/textures/glow_point_red_gold.webp");
        let material = new SpriteMaterial({
            map: map,
            fog: true,
            blending:AdditiveBlending,
            depthWrite:false,
            depthTest:true
        });
        PlayAnimationParticleSparkles.sprite = new Sprite(material);
        game.audio.pending.push(function(){
            foundry.audio.AudioHelper.preloadSound(PlayAnimationParticleSparkles.sound);
        }.bind(this));
    }

    /**@override play */
    async play() {
        this.proton = new Proton();
        let scale = this.computeScale();
        this.emitter = new Proton.Emitter();
        this.emitter.rate = new Proton.Rate(new Proton.Span(350, 450), 0.3);
        this.emitter.addInitialize(new Proton.Mass(1,0.3));
        this.emitter.addInitialize(new Proton.Life(1,3));
        this.emitter.addInitialize(new Proton.Body(PlayAnimationParticleSparkles.sprite));
        this.emitter.addInitialize(new Proton.Radius(100 * scale, 60 * scale));
        this.emitter.addInitialize(new Proton.Position(new Proton.SphereZone(0,0,0,30 * LEGACY_TO_METERS)));
        this.emitter.addInitialize(new Proton.Velocity(200, new Proton.Vector3D(0, 0, 0), 0));

        this.emitter.addBehaviour(new Proton.RandomDrift(10 * LEGACY_TO_METERS, 5 * LEGACY_TO_METERS, 10 * LEGACY_TO_METERS, 0.1, Infinity, Proton.easeOutQuart));
        this.emitter.addBehaviour(new Proton.Alpha(1, 0));
        this.emitter.addBehaviour(new Proton.Scale(1, 0.5));

        this.emitter.addBehaviour(new Proton.Force(0, 1 * LEGACY_TO_METERS, 0));

        let parent = null;
        if(this.dicemesh.isMesh){
            parent = this.dicemesh.parent;
        } else {
            parent = this.dicemesh.parent.clone();
            delete parent.children[0].geometry;
        }

        this.emitter.p.x = parent.position.x;

        let boundingBox = new Vector3();
        new Box3().setFromObject(parent).getSize(boundingBox);

        this.emitter.p.y = boundingBox.y/2;
        this.emitter.p.z = parent.position.z;
        this.emitter.emit('once',true);
        this.proton.addEmitter(this.emitter);
        this.proton.addRender(new Proton.SpriteRender(this.box.scene));

        foundry.audio.AudioHelper.play({
            src: PlayAnimationParticleSparkles.sound,
            volume: this.volume
		}, false);
        this.renderReady = true;
    }

    render() {
        if(!this.renderReady)
            return;
        this.proton.update();
        if(this.proton.emitters.length == 0){
            this.destroy();
        }
    }

    destroy(){
        if(this.emitter){
            this.emitter.stopEmit();
            this.emitter.removeAllParticles();
        }
        this.proton.update();
        this.proton.destroy();
        this.destroyed = true;
    }
}