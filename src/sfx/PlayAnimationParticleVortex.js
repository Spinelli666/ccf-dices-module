// Modified by ccf-web (2026-10-12) from Dice So Nice 6.2.9 (AGPL-3.0): asset URLs made absolute (/modules/dice-so-nice/...).
import { Mesh, MeshBasicMaterial, NormalBlending, PlaneGeometry } from 'three';
import { DiceSFX } from './DiceSFX.js';
import { Proton } from '../libs/three.proton.js';
import { DiceSFXManager } from './DiceSFXManager.js';
import { LEGACY_TO_METERS } from '../engine/SceneConstants.js';

export class PlayAnimationParticleVortex extends DiceSFX {
    static id = "PlayAnimationParticleVortex";
    static specialEffectName = "DICESONICE.PlayAnimationParticleVortex";
    static sprite = null;
    static sound = "/modules/dice-so-nice/sfx/sounds/vortex.mp3";
    /**@override init */
    static async init() {
        let map = await this.loadAsset(DiceSFXManager.TextureLoader, "/modules/dice-so-nice/sfx/textures/magic01.webp");
        let material = new MeshBasicMaterial({
            map: map,
            blending:NormalBlending,
            depthWrite:false,
            depthTest:true,
            transparent:true
        });
        let geometry = new PlaneGeometry(140,140);
        //bake into XZ since Proton overwrites mesh rotation each frame
        geometry.rotateX(-Math.PI / 2);
        PlayAnimationParticleVortex.sprite = new Mesh(geometry,material);
        
        game.audio.pending.push(function(){
            foundry.audio.AudioHelper.preloadSound(PlayAnimationParticleVortex.sound);
        }.bind(this));
    }

    /**@override play */
    async play() {
        this.proton = new Proton();
        this.emitter = new Proton.Emitter();
        this.emitter.rate = new Proton.Rate(new Proton.Span(6, 8), new Proton.Span(.1, .25));
        this.emitter.addInitialize(new Proton.Mass(1));
        this.emitter.addInitialize(new Proton.Life(0.8,2.4));
        this.emitter.addInitialize(new Proton.Body(PlayAnimationParticleVortex.sprite));
        this.emitter.addInitialize(new Proton.Velocity(50 * LEGACY_TO_METERS, new Proton.Vector3D(0,1,0), 0));
        let scale = this.computeScale();
        this.emitter.addInitialize(new Proton.Radius(scale));

        this.emitter.addBehaviour(new Proton.Color(['#1f0e26','#462634','#290088'],'#060206'));
        this.emitter.addBehaviour(new Proton.Alpha(0.7, 0, Infinity, Proton.easeInQuart));
        this.emitter.addBehaviour(new Proton.Scale(0.7, 1.3, Infinity, Proton.easeInSine));
        this.emitter.addBehaviour(new Proton.Rotate(0,-3,0));

        this.emitter.p.x = this.dicemesh.parent.position.x;
        this.emitter.p.y = -5 * LEGACY_TO_METERS;
        this.emitter.p.z = this.dicemesh.parent.position.z;
        this.emitter.emit(1.25,true);

        this.proton.addEmitter(this.emitter);
        this.proton.addRender(new Proton.MeshRender(this.box.scene));

        foundry.audio.AudioHelper.play({
            src: PlayAnimationParticleVortex.sound,
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