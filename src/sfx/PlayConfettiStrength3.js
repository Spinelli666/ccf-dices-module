import { DiceSFX } from './DiceSFX.js';

export class PlayConfettiStrength3 extends DiceSFX {
    static id = "PlayConfettiStrength3";
    static specialEffectName = "DICESONICE.PlayConfettiStrength3";

    /**@override play */
    async play(){
        const api = game.modules.get('celebrate').api;
        const strength = api.confettiStrength.high;
        const shootConfettiProps = api.getShootConfettiProps(strength);
        api.handleShootConfetti(shootConfettiProps);
    }
}