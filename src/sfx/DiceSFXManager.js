import { TextureLoader } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { PlayAnimationBright } from './PlayAnimationBright.js';
import { PlayAnimationDark } from './PlayAnimationDark.js';
import { PlayAnimationImpact } from './PlayAnimationImpact.js';
import { PlayAnimationOutline } from './PlayAnimationOutline.js';
import { PlayAnimationParticleSparkles } from './PlayAnimationParticleSparkles.js';
import { PlayAnimationParticleSpiral } from './PlayAnimationParticleSpiral.js';
import { PlayAnimationParticleVortex } from './PlayAnimationParticleVortex.js';
import { PlayAnimationThormund } from './PlayAnimationThormund.js';
import { PlayConfettiStrength1 } from './PlayConfettiStrength1.js';
import { PlayConfettiStrength2 } from './PlayConfettiStrength2.js';
import { PlayConfettiStrength3 } from './PlayConfettiStrength3.js';
import { PlayMacro } from './PlayMacro.js';
import { PlaySoundCustom } from './PlaySoundCustom.js';
import { PlaySoundEpicFail } from './PlaySoundEpicFail.js';
import { PlaySoundEpicWin } from './PlaySoundEpicWin.js';

export const DiceSFXManager = {
    SFX_MODE_CLASS : {
        "PlayAnimationBright": PlayAnimationBright,
        "PlayAnimationDark": PlayAnimationDark,
        "PlayAnimationOutline": PlayAnimationOutline,
        "PlayAnimationImpact": PlayAnimationImpact,
        "PlayConfettiStrength1": PlayConfettiStrength1,
        "PlayConfettiStrength2": PlayConfettiStrength2,
        "PlayConfettiStrength3": PlayConfettiStrength3,
        "PlayAnimationThormund": PlayAnimationThormund,
        "PlayAnimationParticleSpiral": PlayAnimationParticleSpiral,
        "PlayAnimationParticleSparkles": PlayAnimationParticleSparkles,
        "PlayAnimationParticleVortex": PlayAnimationParticleVortex,
        "PlaySoundEpicWin": PlaySoundEpicWin,
        "PlaySoundEpicFail": PlaySoundEpicFail,
        "PlaySoundCustom": PlaySoundCustom,
        "PlayMacro": PlayMacro
    },
    SFX_MODE_LIST : null,
    SFX_CLASS : {},
    EXTRA_TRIGGER_TYPE : [],
    EXTRA_TRIGGER_RESULTS : {},
    renderQueue : [],
    garbageCollector : [],
    GLTFLoader : null,
    TextureLoader: null,
    // Base delay (ms) before starting any SFX
    playDelayBase: 100,
    // Additional randomized jitter (ms) added to the base delay to stagger multiple SFX
    playDelayJitter: 750,
    init : function(){
        if(!DiceSFXManager.SFX_MODE_LIST){
            DiceSFXManager.SFX_MODE_LIST = {};
            Object.values(DiceSFXManager.SFX_MODE_CLASS).forEach((sfx)=>{
                if(sfx.id.startsWith("PlayConfettiStrength") && (!game.modules.get("celebrate") || !game.modules.get("celebrate").active))
                    return;
                DiceSFXManager.SFX_MODE_LIST[sfx.id] = sfx.specialEffectName;
            });
        }

        DiceSFXManager.GLTFLoader = new GLTFLoader();
        DiceSFXManager.TextureLoader = new TextureLoader();

        let sfxUniqueList = [];
        game.users.forEach((user) => {
            let sfxList = user.getFlag("dice-so-nice", "sfxList");
            if(sfxList){
                Object.values(sfxList).forEach((line) => {
                    if(line.specialEffect && !Array.isArray(line.specialEffect)){
                        sfxUniqueList.push(line.specialEffect);
                    } 
                });
            }
        });
        //remove duplicate
        sfxUniqueList = sfxUniqueList.filter((v, i, a) => a.indexOf(v) === i);

        //for each possible sfx, initialize
        sfxUniqueList.forEach((sfxClassName) => {
            if(sfxClassName.startsWith("PlayConfettiStrength") && (!game.modules.get("celebrate") || !game.modules.get("celebrate").active))
                return;
            DiceSFXManager.addSFXMode(DiceSFXManager.SFX_MODE_CLASS[sfxClassName]);
        });
    },
    addSFXMode : async function(sfx){
        if(sfx && sfx.id && sfx.specialEffectName && !sfx.initialized){
            DiceSFXManager.SFX_CLASS[sfx.id] = sfx;
            sfx.initialized = true;
            await sfx.init();
        }
    },
    playSFX : async function(sfx, box, dicemesh){
        let id = sfx.specialEffect;
        return new Promise(async (resolve)=>{
            if(!DiceSFXManager.SFX_CLASS[id]){
                if(DiceSFXManager.SFX_MODE_CLASS[id]){
                    await DiceSFXManager.addSFXMode(DiceSFXManager.SFX_MODE_CLASS[id]);
                } else {
                    return;
                }
            }
            
            const options = Object.assign({}, sfx.options);
            if (sfx._messageId !== undefined) options._messageId = sfx._messageId;
            let sfxInstance = new DiceSFXManager.SFX_CLASS[id](box, dicemesh, options);
            // Compute jitter using a simple Math.random based distribution.
            const maxJitter = DiceSFXManager.playDelayJitter || 0;
            const jitter = maxJitter > 0 ? Math.floor(Math.random() * (maxJitter + 1)) : 0;
            const delay = (DiceSFXManager.playDelayBase || 0) + jitter;
            setTimeout(()=>{
                sfxInstance.play(options).then(result => {
                    if(result !== false){
                        if(typeof sfxInstance.render === 'function')
                            DiceSFXManager.renderQueue.push(sfxInstance);
                        if(sfxInstance.enableGC)
                            DiceSFXManager.garbageCollector.push(sfxInstance);
                    }
                    resolve();
                });
            }, delay);
        });
    },
    renderSFX : function(){
        let queue = [...DiceSFXManager.renderQueue];
        for(let i =0;i<queue.length;i++){
            let sfxInstance = queue[i];
            if(sfxInstance.destroyed){
                DiceSFXManager.endSFX(sfxInstance);
            } else {
                if(typeof sfxInstance.render === 'function')
                    sfxInstance.render();
            }
        }
    },
    endSFX : function(sfxInstance){
        let index = DiceSFXManager.renderQueue.indexOf(sfxInstance);
        if(index !== -1)
            DiceSFXManager.renderQueue.splice(index, 1);
        if(DiceSFXManager.renderQueue.length == 0)
            game.dice3d._afterShow();
    },
    clearQueue : function(){
        let queue = [...DiceSFXManager.renderQueue];
        for(let i =0;i<queue.length;i++){
            let sfxInstance = queue[i];
            if(typeof sfxInstance.destroy === 'function')
                sfxInstance.destroy();
                DiceSFXManager.endSFX(sfxInstance);
        }
        //For animations that do not have a render loop but still require some cleaning
        for(let i = 0;i<DiceSFXManager.garbageCollector.length;i++){
            DiceSFXManager.garbageCollector[i].destroy();
        }
        DiceSFXManager.garbageCollector = [];
    },
    registerSFXModeClass : function(sfxClass){
        DiceSFXManager.SFX_MODE_CLASS[sfxClass.id] = sfxClass;
        DiceSFXManager.SFX_MODE_LIST[sfxClass.id] = sfxClass.specialEffectName;
    }
}