import { DiceSFX } from './DiceSFX.js';

export class PlayConfettiStrength2 extends DiceSFX {
    static id = "PlayConfettiStrength2";
    static specialEffectName = "DICESONICE.PlayConfettiStrength2";

    /**@override play */
    async play(){
        const api = game.modules.get('celebrate').api;
        const strength = api.confettiStrength.med;
        const shootConfettiProps = api.getShootConfettiProps(strength);
        api.handleShootConfetti(shootConfettiProps);
    }
}