// Modified by ccf-web (2026-10-12) from Dice So Nice 6.2.9 (AGPL-3.0): asset URLs made absolute (/modules/dice-so-nice/...).
import { DiceSFX } from './DiceSFX.js';

export class PlaySoundEpicFail extends DiceSFX {
    static id = "PlaySoundEpicFail";
    static specialEffectName = "DICESONICE.PlaySoundEpicFail";
    static path = '/modules/dice-so-nice/sfx/sounds/epic_fail.mp3';
    static PLAY_ONLY_ONCE_PER_MESH = true;
    /**@override init */
    static async init(){
        game.audio.pending.push(function(){
            foundry.audio.AudioHelper.preloadSound(PlaySoundEpicFail.path);
        }.bind(this));
        return true;
    }

    /**@override play */
    async play(){
        foundry.audio.AudioHelper.play({
            src: PlaySoundEpicFail.path,
            volume: this.volume
		}, false);
    }
}