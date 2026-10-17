// Modified by ccf-web (2026-10-12) from Dice So Nice 6.2.9 (AGPL-3.0): asset URLs made absolute (/modules/dice-so-nice/...).
import { Box3, CatmullRomCurve3, Timer, Vector3 } from 'three';
import { DiceSFX } from './DiceSFX.js';
import { DiceSFXManager } from './DiceSFXManager.js';
import { ShaderUtils } from '../engine/ShaderUtils';
import { LEGACY_TO_METERS } from '../engine/SceneConstants.js';


export class PlayAnimationThormund extends DiceSFX {
    static id = "PlayAnimationThormund";
    static specialEffectName = "DICESONICE.PlayAnimationThormund";
    static file = "/modules/dice-so-nice/sfx/models/thormund.glb";
    static sound = "/modules/dice-so-nice/sfx/sounds/thormund.mp3";
    static model = null;
    static curve = null;
    static duration1 = 2.5;
    static duration2 = 2.5;
    //GLTF model's forward is +Z
    static up = new Vector3(0,0,1);
    /**@override init */
    static async init() {
        game.audio.pending.push(function(){
            foundry.audio.AudioHelper.preloadSound(PlayAnimationThormund.sound);
        }.bind(this));

        let gltf = await this.loadAsset(DiceSFXManager.GLTFLoader, PlayAnimationThormund.file);
        gltf.scene.traverse(function (node) {
            if (node.isMesh) {
                node.castShadow = true; 
                node.material.onBeforeCompile = ShaderUtils.applyDiceSoNiceShader;
            }
        });
        PlayAnimationThormund.model = gltf.scene.children[0];
    }

    /**@override play */
    async play() {
        this.step = 1;
        this.timer = new Timer();
        this.thormund = PlayAnimationThormund.model.clone();
        let scale = this.box.dicefactory.baseScale/100;
        const L = LEGACY_TO_METERS;

        let boundingBox = new Vector3();
        let parent = null;
        if(this.dicemesh.isMesh){
            parent = this.dicemesh.parent;
        } else {
            parent = this.dicemesh.parent.clone();
            delete parent.children[0].geometry;
        }
        new Box3().setFromObject(parent).getSize(boundingBox);

		this.thormund.scale.set(scale,scale,scale);
        this.thormund.position.x = parent.position.x;
        this.thormund.position.y = parent.position.y + (boundingBox.y/2);
        this.thormund.position.z = parent.position.z;

        this.curve = new CatmullRomCurve3( [
            new Vector3( this.thormund.position.x, -50*L, this.thormund.position.z ),
            new Vector3( this.thormund.position.x, this.thormund.position.y, this.thormund.position.z - 100*L ),
            new Vector3( this.thormund.position.x + 100*L, this.thormund.position.y, this.thormund.position.z - 30*L ),
            new Vector3( this.thormund.position.x + 100*L, this.thormund.position.y, this.thormund.position.z + 30*L ),
            new Vector3( this.thormund.position.x + 30*L, this.thormund.position.y, this.thormund.position.z + 100*L ),
            new Vector3( this.thormund.position.x - 30*L, this.thormund.position.y, this.thormund.position.z + 100*L ),
            new Vector3( this.thormund.position.x - 100*L, this.thormund.position.y + 80*L, this.thormund.position.z + 30*L ),
            new Vector3( this.thormund.position.x /2, this.thormund.position.y + 100*L, this.thormund.position.z /2 )
        ],false,"chordal");

        this.curve2 = new CatmullRomCurve3([
            new Vector3( this.thormund.position.x /2, this.thormund.position.y + 100*L, this.thormund.position.z /2 ),
            new Vector3( 100*L, this.box.camera.position.y/4, 50*L ),
            new Vector3( -100*L, this.box.camera.position.y/4*2, -50*L ),
            new Vector3( 0, this.box.camera.position.y/4*3, -50*L ),
            new Vector3( 0, this.box.camera.position.y, 0 )
        ],false,"chordal");

        this.axis = new Vector3();
        this.box.scene.add(this.thormund);
        foundry.audio.AudioHelper.play({
            src: PlayAnimationThormund.sound,
            volume: this.volume
		}, false);
        this.renderReady = true;
    }

    render() {
        if(!this.renderReady)
            return;
        let duration = this.step == 1? PlayAnimationThormund.duration1:PlayAnimationThormund.duration2;
        this.timer.update();
        let x = 1-((duration - this.timer.getElapsed())/duration);
        if(x>1){
            if(this.step == 1){
                this.step++;
                x = 0;
                this.timer = new Timer();
                this.render();
            }
            else
                this.destroy();
        } else {
            let curve = this.step==1?this.curve:this.curve2;
            let p = curve.getPointAt(x);
            let t = curve.getTangentAt(x).normalize();
            this.axis.crossVectors(PlayAnimationThormund.up, t).normalize();
            let radians = Math.acos(PlayAnimationThormund.up.dot(t));

            this.thormund.position.copy(p);
            this.thormund.quaternion.setFromAxisAngle(this.axis,radians);
        }
    }

    destroy(){
        this.box.scene.remove(this.thormund);
        this.destroyed = true;
    }
}