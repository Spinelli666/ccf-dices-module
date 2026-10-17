import { DiceSFX } from './DiceSFX.js';

export class PlayAnimationOutline extends DiceSFX {
    static id = "PlayAnimationOutline";
    static specialEffectName = "DICESONICE.PlayAnimationOutline";

    /**@override play */
    async play() {
        this.box.outlinePass.selectedObjects.push(this.dicemesh);
    }

    destroy(){
        this.box.outlinePass.selectedObjects = this.box.outlinePass.selectedObjects.filter(obj => obj != this.dicemesh);
        this.destroyed = true;
    }
}