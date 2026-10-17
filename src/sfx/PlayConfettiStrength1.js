import { DiceSFX } from './DiceSFX.js';

export class PlayConfettiStrength1 extends DiceSFX {
    static id = "PlayConfettiStrength1";
    static specialEffectName = "DICESONICE.PlayConfettiStrength1";

    /**@override play */
    async play(){
        const api = game.modules.get('celebrate').api;
        const strength = api.confettiStrength.low;
        const shootConfettiProps = api.getShootConfettiProps(strength);
        api.handleShootConfetti(shootConfettiProps);
    }
}