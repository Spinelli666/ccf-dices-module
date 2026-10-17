import { DiceSFX } from './DiceSFX.js';
import { DiceSFXManager } from './DiceSFXManager.js';

/**
 * Options needed: macro ID
 */
export class PlayMacro extends DiceSFX {
    static id = "PlayMacro";
    static specialEffectName = "DICESONICE.PlayMacro";
    static PLAY_ONLY_ONCE_PER_MESH = true;

    /**@override play */
    async play(options){
        let macro = game.macros.get(options.macroId);
        if(!macro) return;

        const messageId = this.options._messageId ?? null;
        const roll = messageId ? game.messages.get(messageId)?.rolls?.[0] ?? null : null;
        const dsnDie = {
            type: this.dicemesh.notation?.type,
            result: this.dicemesh.forcedResult,
            options: this.dicemesh.options || {}
        };
        const box = this.box;
        const dicemesh = this.dicemesh;
        const playSFX = (sfxId) => {
            DiceSFXManager.playSFX({ specialEffect: sfxId, options: {} }, box, dicemesh);
        };

        try {
            await macro.execute({ messageId, roll, dsnDie, playSFX });
        } catch (err) {
            console.error(`[Dice So Nice] SFX macro "${macro.name}" threw an error:`, err);
        }
    }

    static getDialogContent(sfxLine,id){
        let dialogContent = super.getDialogContent(sfxLine,id);

        dialogContent.content = dialogContent.content.concat(`<div class="form-group">
                                        <label>{{localize "DICESONICE.sfxOptionsMacro"}}</label>
                                        <div class="form-fields">
                                            <select name="sfxLine[{{id}}][options][macroId]">
                                                {{selectOptions macroList valueAttr="id" labelAttr="name" selected=macroId}}
                                            </select>
                                        </div>
                                    </div>`);
        
        dialogContent.data.macroList = game.macros.filter(macro => macro.canExecute).map(macro => {return {id:macro.id,name:macro.name}});
        
        dialogContent.data.macroList.sort((a, b) => a.name > b.name && 1 || -1);
        dialogContent.data.macroId = sfxLine.options?sfxLine.options.macroId:null;
        return dialogContent;
    }
}