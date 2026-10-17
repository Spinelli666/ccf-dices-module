// Modified by ccf-web (2026-10-12) from Dice So Nice 6.2.9 (AGPL-3.0): asset URLs made absolute (/modules/dice-so-nice/...).
import { Timer, Color } from 'three';
import { DiceSFX } from './DiceSFX.js';
import { ShaderUtils } from '../engine/ShaderUtils';

export class PlayAnimationBright extends DiceSFX {
    static id = "PlayAnimationBright";
    static specialEffectName = "DICESONICE.PlayAnimationBright";
    static brightColor = null;
    static duration = 0.6;
    static sound = "/modules/dice-so-nice/sfx/sounds/bright.mp3";
    /**@override init */
    static async init() {
        PlayAnimationBright.brightColor = new Color(0.5,0.5,0.5);
        this.glowingMesh=null;
        game.audio.pending.push(function(){
            foundry.audio.AudioHelper.preloadSound(PlayAnimationBright.sound);
        }.bind(this));
    }

    /**@override play */
    async play() {
        if(!this.dicemesh.material && this.dicemesh.userData.glow){
            //We check if there's a glow target specified
            this.dicemesh.traverse(object => {
                if (object.userData && object.userData.name && object.userData.name === this.dicemesh.userData.glow) this.glowingMesh=object;
            });
        } else if(this.dicemesh.material){
            this.glowingMesh=this.dicemesh;
        } else {
            return false;
        }
        if(!this.glowingMesh.material.emissiveMap)
            return false;
        this.timer = new Timer();
        this.baseColor = this.glowingMesh.material.emissive.clone();
        this.baseMaterial = this.glowingMesh.material;
        this.glowingMesh.material = this.baseMaterial.clone();
        //swap to full emissive map so bright SFX lights all labels (read from original, clone destroys CanvasTexture refs)
        if (this.baseMaterial.userData.emissiveMapFull) {
            this.glowingMesh.material.emissiveMap = this.baseMaterial.userData.emissiveMapFull;
        }
        this.glowingMesh.material.onBeforeCompile = ShaderUtils.applyDiceSoNiceShader;
        foundry.audio.AudioHelper.play({
            src: PlayAnimationBright.sound,
            volume: this.volume
		}, false);
        this.renderReady = true;
    }

    render() {
        if(!this.renderReady)
            return;
        this.timer.update();
        let x = 1-((PlayAnimationBright.duration - this.timer.getElapsed())/PlayAnimationBright.duration);
        if(x>1){
            this.destroy();
        } else {
            let val = (Math.sin(2 * Math.PI * (x - 1/4)) + 1) / 2;
            this.glowingMesh.material.emissive.copy(this.baseColor);
            this.glowingMesh.material.emissive.lerp(PlayAnimationBright.brightColor, val);
        }
    }

    destroy(){
        let sfxMaterial = this.glowingMesh.material;
        this.glowingMesh.material = this.baseMaterial;
        sfxMaterial.dispose();
        this.destroyed = true;
    }
}