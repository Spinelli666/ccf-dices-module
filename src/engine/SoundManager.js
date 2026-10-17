// Modified by ccf-web (2026-10-12) from Dice So Nice 6.2.9 (AGPL-3.0): asset URLs made absolute (/modules/dice-so-nice/...).
export class SoundManager {
    constructor() {
        this.sounds_table = {};
        this.sounds_dice = {};
        this.sounds_coins = [];
        this.sounds = true;
        this.volume = 1;
        this.soundsSurface = "felt";
        this.muteSoundSecretRolls = false;
        this.preloaded = false;
    }

    update(config) {
        this.sounds = config.sounds || this.sounds;
        this.volume = config.volume || this.volume;
        this.soundsSurface = config.soundsSurface || this.soundsSurface;
        this.muteSoundSecretRolls = config.muteSoundSecretRolls || this.muteSoundSecretRolls;

        if (!this.preloaded) {
            this.preloaded = true;
            game.audio.pending.push(this.preloadSounds.bind(this));
        }
    }

    preloadSounds() {
        // Surfaces
        this.fetchJsonResource('/modules/dice-so-nice/sounds/surfaces.json')
            .then(surfacesJson => {
                this.processSoundsData(this.sounds_table, surfacesJson, 'surface');
            });

        // Hits
        this.fetchJsonResource('/modules/dice-so-nice/sounds/dicehit.json')
            .then(diceHitJson => {
                this.processSoundsData(this.sounds_dice, diceHitJson, 'dicehit');
            });
    }

    fetchJsonResource(url) {
        return fetch(url).then(response => response.json());
    }

    processSoundsData(target, jsonData, prefix) {
        const sound = new foundry.audio.Sound(`/modules/dice-so-nice/sounds/${jsonData.resources[0]}`, {forceBuffer:true, context: game.audio.interface});

        //preload the sound
        sound.load().then(src => target.source = src);

        Object.entries(jsonData.spritemap).forEach(sound => {
            let type = sound[0].match(new RegExp(`${prefix}\\_([a-z\\_]*)`))[1];
            if (!target[type])
                target[type] = [];
            target[type].push(sound[1]);
        });
    }

    playAudioSprite(source, sprite, selfVolume) {
        if (!source)
            return false;

        const spriteInstance = new foundry.audio.Sound(source.src,{forceBuffer:true, context: game.audio.interface});
        //in v12, the load() method use a cache so we can call it without any extra network calls
        spriteInstance.load().then(sound => sound.play({loop: sprite.loop, loopStart: sprite.start, loopEnd: sprite.end, volume: selfVolume * this.volume}));
    }

    eventCollide({ source, diceType, diceMaterial, strength }) {
        if (!this.sounds || !this.sounds_dice.source) return;

        const sound = this.selectSound(source, diceType, diceMaterial);
        const audioSource = this.getSoundSource(source);
        this.playAudioSprite(audioSource, sound, strength);
    }

    getSoundSource(source) {
        if (source === "dice") {
            return this.sounds_dice.source;
        } else {
            return this.sounds_table.source;
        }
    }

    selectSound(source, diceType, diceMaterial) {
        let sound;

        if (source === "dice") {
            if (diceType !== "dc") {
                let sounds_dice = this.sounds_dice['plastic'];
                if (this.sounds_dice[diceMaterial]) {
                    sounds_dice = this.sounds_dice[diceMaterial];
                }
                sound = sounds_dice[Math.floor(Math.random() * sounds_dice.length)];
            } else {
                sound = this.sounds_dice['coin'][Math.floor(Math.random() * this.sounds_dice['coin'].length)];
            }
        } else {
            const surface = this.soundsSurface;
            const soundlist = this.sounds_table[surface];
            sound = soundlist[Math.floor(Math.random() * soundlist.length)];
        }

        return sound;
    }

    generateCollisionSounds(workerCollides) {
        const detectedCollides = new Array(1000);
        if (!this.sounds || !this.sounds_dice.source) return detectedCollides;

        for (let i = 0; i < workerCollides.length; i++) {
            const collide = workerCollides[i];
            if (!collide) continue;

            const [source, diceType, diceMaterial, strength] = collide;
            const sound = this.selectSound(source, diceType, diceMaterial);
            const audioSource = this.getSoundSource(source);
            detectedCollides[i] = [audioSource, sound, strength];
        }

        return detectedCollides;
    }
}