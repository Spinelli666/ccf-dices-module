export class DiceSFX {
    // Whether this SFX should only be played once per logical dice (even if represented by multiple meshes, e.g., percentile dice)
    static PLAY_ONLY_ONCE_PER_MESH = false;
    get nameLocalized(){
        return game.i18n.localize(this._name);
    }
    
    constructor(box, dicemesh, options){
        const defaultOptions = {
            isGlobal : false,
            muteSound : false
        };

        this.options = foundry.utils.mergeObject(defaultOptions, options);

        this.dicemesh = dicemesh;
        this.box = box;
        this.destroyed = false;
        this.enableGC = false;
        this.renderReady = false;
        this.volume = (dicemesh.options.secretRoll && box.muteSoundSecretRolls) || this.options.muteSound ? 0 : this.box.volume;
    }

    static async init(){
        return true;
    }

    computeScale(){
        let scale = this.box.dicefactory.baseScale / 100;
        switch (this.dicemesh.shape) {
            case "d2":
                scale *= 1.3;
                break;
            case "d4":
                scale *= 1.1;
                break;
            case "d6":
                break;
            case "d8":
                scale *= 1.1;
                break;
            case "d10":
                break;
            case "d12":
                scale *= 1.2;
                break;
            case "d20":
                scale *= 1.3;
                break;
        }
        return scale;
    }

    async play(){
        return Promise.resolve();
    }

    static async loadAsset(loader,url) {
        return new Promise((resolve, reject) => {
          loader.load(url, data=> resolve(data), null, reject);
        });
    }

    static getDialogContent(sfxLine,id){
        let dialogContent = {};
        let disabled = game.user.isGM ? '':'disabled="disabled"';
        dialogContent.content = `<div class="form-group">
                                    <label>{{localize "DICESONICE.sfxOptionsIsGlobal"}}</label>
                                    <div class="form-fields">
                                        <input type="checkbox" name="sfxLine[{{id}}][options][isGlobal]" data-dtype="Boolean" ${disabled} {{checked isGlobal}} />
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label>{{localize "DICESONICE.sfxOptionsMuteSound"}}</label>
                                    <div class="form-fields">
                                        <input type="checkbox" name="sfxLine[{{id}}][options][muteSound]" data-dtype="Boolean" ${disabled} {{checked muteSound}} />
                                    </div>
                                </div>`;

        dialogContent.data = {
            isGlobal : sfxLine.options ? sfxLine.options.isGlobal:false,
            muteSound : sfxLine.options ? sfxLine.options.muteSound:false,
            id:id
        };

        return dialogContent;
    }
}