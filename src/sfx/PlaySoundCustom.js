import { DiceSFX } from './DiceSFX.js';

/**
 * Options needed: path OR playlistId
 */
export class PlaySoundCustom extends DiceSFX {
    static id = "PlaySoundCustom";
    static specialEffectName = "DICESONICE.PlaySoundCustom";
    static PLAY_ONLY_ONCE_PER_MESH = true;

    /**@override play */
    async play(options){
        const src = this._resolveSource(options);
        if(src){
            foundry.audio.AudioHelper.play({
                src,
                volume: this.volume
            }, false);
        }
    }

    // playlist wins over path when both are set
    _resolveSource(options){
        if(!options) return null;
        if(options.playlistId){
            const playlist = game.playlists?.get(options.playlistId);
            const sounds = playlist ? Array.from(playlist.sounds) : [];
            if(sounds.length){
                const pick = sounds[Math.floor(Math.random() * sounds.length)];
                if(pick?.path) return pick.path;
            }
        }
        return options.path || null;
    }

    static getDialogContent(sfxLine,id){
        let dialogContent = super.getDialogContent(sfxLine,id);

        dialogContent.content = dialogContent.content.concat(`<div class="form-group">
                                        <label>{{localize "DICESONICE.sfxOptionsCustomSound"}}</label>
                                        <div class="form-fields">
                                            <button type="button" class="file-picker" data-type="audio" data-target="sfxLine[{{id}}][options][path]" title="Browse Files" tabindex="-1">
                                                <i class="fas fa-file-import fa-fw"></i>
                                            </button>
                                            <input class="image" type="text" name="sfxLine[{{id}}][options][path]" placeholder="path/audio.mp3" value="{{path}}">
                                        </div>
                                    </div>
                                    <div class="form-group">
                                        <label>{{localize "DICESONICE.sfxOptionsCustomSoundPlaylist"}}</label>
                                        <div class="form-fields">
                                            <select name="sfxLine[{{id}}][options][playlistId]">
                                                <option value="">—</option>
                                                {{selectOptions playlistList valueAttr="id" labelAttr="name" selected=playlistId}}
                                            </select>
                                        </div>
                                    </div>`);

        dialogContent.data.path = sfxLine.options ? sfxLine.options.path:"";
        dialogContent.data.playlistId = sfxLine.options ? (sfxLine.options.playlistId || "") : "";
        dialogContent.data.playlistList = (game.playlists?.contents ?? [])
            .filter(p => p.sounds?.size > 0 && p.testUserPermission(game.user, "OBSERVER"))
            .map(p => ({id: p.id, name: p.name}))
            .sort((a, b) => a.name.localeCompare(b.name));
        return dialogContent;
    }
}
