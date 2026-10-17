import { DiceColors } from './DiceColors.js';
import { AssetsLoader } from '../AssetsLoader.js';
import { CustomDiceTerms } from './CustomDiceTerms.js';

/**
 * Manages CRUD on the user's custom dice library (stored in dice-so-nice/diceLibrary flag).
 */
export class DiceLibrary {

    static LIBRARY_DIE_TYPES = ["df", "d2", "d3", "d4", "d5", "d6", "d7", "d8", "d10", "d12", "d14", "d16", "d20", "d24", "d30", "d100", "d1000", "d10000"];

    static _imageCache = {};

    static getFullDieTypes() {
        const custom = CustomDiceTerms.getRegisteredDenominations();
        if (custom.size === 0) return this.LIBRARY_DIE_TYPES;
        const customTypes = [...custom].map(d => "d" + d);
        return [...this.LIBRARY_DIE_TYPES, ...customTypes];
    }

    constructor() {
        this._dice = [];
    }

    async load() {
        const data = game.user.getFlag("dice-so-nice", "diceLibrary");
        this._dice = Array.isArray(data) ? data : [];
    }

    async save() {
        await game.user.unsetFlag("dice-so-nice", "diceLibrary");
        await game.user.setFlag("dice-so-nice", "diceLibrary", this._dice);
    }

    get(id) {
        return this._dice.find(d => d.id === id) || null;
    }

    getAll() {
        return [...this._dice];
    }

    getByType(dieType) {
        return this._dice.filter(d => d.dieType === dieType);
    }

    getByNameAndType(name, dieType) {
        const needle = name.toLowerCase();
        return this._dice.find(d => d.name.toLowerCase() === needle && d.dieType === dieType) || null;
    }

    async add(dieData) {
        const die = foundry.utils.deepClone(dieData);
        die.id = foundry.utils.randomID();
        die.createdAt = Date.now();
        die.updatedAt = Date.now();
        this._dice.push(die);
        await this.save();
        return die;
    }

    async update(id, dieData) {
        const index = this._dice.findIndex(d => d.id === id);
        if (index === -1) return null;
        foundry.utils.mergeObject(this._dice[index], dieData);
        this._dice[index].updatedAt = Date.now();
        await this.save();
        return this._dice[index];
    }

    async delete(id) {
        this._dice = this._dice.filter(d => d.id !== id);
        await this.save();
    }

    async duplicate(id) {
        const original = this.get(id);
        if (!original) return null;
        const copy = foundry.utils.deepClone(original);
        copy.id = foundry.utils.randomID();
        copy.name = `${copy.name} (Copy)`;
        copy.createdAt = Date.now();
        copy.updatedAt = Date.now();
        this._dice.push(copy);
        await this.save();
        return copy;
    }

    export(id) {
        const die = this.get(id);
        if (!die) return null;
        return JSON.stringify({
            dsnLibraryExport: true,
            version: 1,
            dice: [foundry.utils.deepClone(die)]
        }, null, 2);
    }

    exportAll() {
        const exportDice = this._dice.map(d => foundry.utils.deepClone(d));
        return JSON.stringify({
            dsnLibraryExport: true,
            version: 1,
            dice: exportDice
        }, null, 2);
    }

    //preserves IDs from export, skips duplicates
    async import(jsonString) {
        let parsed;
        try {
            parsed = JSON.parse(jsonString);
        } catch (e) {
            throw new Error("Invalid JSON format");
        }
        if (!parsed.dsnLibraryExport || !Array.isArray(parsed.dice)) {
            throw new Error("Invalid dice library export format");
        }
        return this.importArray(parsed.dice);
    }

    async importArray(diceArray) {
        if (!Array.isArray(diceArray) || diceArray.length === 0) return { imported: 0, skipped: 0 };
        const existingIds = new Set(this._dice.map(d => d.id));
        let imported = 0;
        let skipped = 0;
        for (const dieData of diceArray) {
            const die = foundry.utils.deepClone(dieData);
            if (die.id && existingIds.has(die.id)) {
                skipped++;
                continue;
            }
            if (!die.id) die.id = foundry.utils.randomID();
            die.updatedAt = Date.now();
            this._dice.push(die);
            existingIds.add(die.id);
            imported++;
        }
        if (imported > 0) await this.save();
        return { imported, skipped };
    }

    //merge baseAppearance with per-face overrides, null = inherit from base
    static resolveFaceAppearance(libraryDie, faceValue) {
        const base = foundry.utils.deepClone(libraryDie.baseAppearance || {});
        const faceKey = String(faceValue);
        const faceOverride = libraryDie.faces?.[faceKey];

        if (!faceOverride) return base;

        const resolved = { ...base };
        for (const [key, value] of Object.entries(faceOverride)) {
            if (value !== null && value !== undefined) {
                resolved[key] = value;
            }
        }
        return resolved;
    }

    static getLibraryForUser(user) {
        const data = user.getFlag("dice-so-nice", "diceLibrary");
        return Array.isArray(data) ? data : [];
    }

    static getFromUser(user, id) {
        const library = DiceLibrary.getLibraryForUser(user);
        return library.find(d => d.id === id) || null;
    }

    static getByNameAndTypeForUser(user, name, dieType) {
        const needle = name.toLowerCase();
        const library = DiceLibrary.getLibraryForUser(user);
        return library.find(d => d.name.toLowerCase() === needle && d.dieType === dieType) || null;
    }

    //preload label images and custom textures for library dice in active appearances
    static async preloadAssets(userID = null, documentUuid = null) {
        const urls = new Set();
        const customTextures = new Map();
        const collectFromAppearance = (appearance, fallbackOwner = null) => {
            if (!appearance) return;

            for (const scope in appearance) {
                if (!appearance.hasOwnProperty(scope)) continue;
                const libId = appearance[scope]?.libraryDieId;
                if (!libId) continue;
                const ownerId = appearance[scope]?.libraryDieOwner;
                const owner = ownerId ? game.users.get(ownerId) : fallbackOwner;
                if (!owner) continue;
                const die = DiceLibrary.getFromUser(owner, libId);
                if (!die) continue;

                if (die.baseAppearance?.texture?.startsWith("custom:")) {
                    const path = die.baseAppearance.texture.slice(7);
                    if (!customTextures.has(path)) {
                        customTextures.set(path, die.baseAppearance.textureComposite || "multiply");
                    }
                }

                if (!die.faces) continue;
                for (const faceData of Object.values(die.faces)) {
                    if (faceData?.labelImage) urls.add(faceData.labelImage);
                    if (faceData?.backgroundTexture?.startsWith("custom:")) {
                        const path = faceData.backgroundTexture.slice(7);
                        if (!customTextures.has(path)) {
                            customTextures.set(path, faceData.backgroundTextureComposite || die.baseAppearance?.textureComposite || "multiply");
                        }
                    }
                }
            }
        };

        if (documentUuid) {
            const doc = foundry.utils.fromUuidSync(documentUuid);
            if (doc) collectFromAppearance(doc.getFlag("dice-so-nice", "appearance"));
        } else if (userID) {
            const user = game.users.get(userID);
            if (user) collectFromAppearance(user.getFlag("dice-so-nice", "appearance"), user);
        } else {
            game.users.forEach(user => collectFromAppearance(user.getFlag("dice-so-nice", "appearance"), user));
        }

        const promises = [];

        for (const [path, composite] of customTextures) {
            promises.push(
                DiceColors.registerCustomTexture(path, composite).catch(err => {
                    console.warn(`[Dice So Nice] Failed to preload custom texture: ${path}`, err);
                })
            );
        }

        if (urls.size > 0) {
            const loader = new AssetsLoader();
            for (const url of urls) {
                if (DiceLibrary._imageCache[url]) continue;
                promises.push(
                    loader.load([url]).then(result => {
                        DiceLibrary._imageCache[url] = result[url];
                    }).catch(err => {
                        console.warn(`[Dice So Nice] Failed to preload label image: ${url}`, err);
                    })
                );
            }
        }

        await Promise.all(promises);
    }

    static getLoadedImage(url) {
        return DiceLibrary._imageCache[url] || null;
    }

    static async loadImage(url) {
        if (DiceLibrary._imageCache[url]) return DiceLibrary._imageCache[url];
        const loader = new AssetsLoader();
        const result = await loader.load([url]);
        DiceLibrary._imageCache[url] = result[url];
        return result[url];
    }

    static createEmptyDie(dieType, name = "Custom Die") {
        return {
            name,
            dieType,
            baseAppearance: {
                labelColor: "#FFFFFF",
                diceColor: "#000000",
                outlineColor: "",
                edgeColor: "",
                texture: "none",
                material: "plastic",
                font: "auto",
                colorset: "custom"
            },
            faces: {}
        };
    }

    //build optgroup data for the library die dropdown in DiceConfig
    static buildLibraryDiceGroups(dieType, appearance, selectedOverride = null) {
        const myId = game.user.id;
        const selectedId = selectedOverride ?? appearance?.libraryDieId ?? "";
        const selectedOwner = appearance?.libraryDieOwner ?? "";
        const selectedVal = (selectedOwner && selectedOwner !== myId) ? `${selectedOwner}:${selectedId}` : selectedId;

        const groups = [];

        const myDice = game.dice3d.diceLibrary ? game.dice3d.diceLibrary.getAll().filter(d => d.dieType === dieType) : [];
        if (myDice.length > 0) {
            groups.push({
                label: game.i18n.localize("DICESONICE.libraryMyDice"),
                dice: myDice.map(d => ({
                    value: d.id,
                    name: d.name,
                    selected: d.id === selectedVal
                }))
            });
        }

        for (const user of game.users) {
            if (user.id === myId) continue;
            const userDice = DiceLibrary.getLibraryForUser(user).filter(d => d.dieType === dieType);
            if (userDice.length > 0) {
                groups.push({
                    label: game.i18n.format("DICESONICE.libraryUserDice", { name: user.name }),
                    dice: userDice.map(d => ({
                        value: `${user.id}:${d.id}`,
                        name: d.name,
                        selected: `${user.id}:${d.id}` === selectedVal
                    }))
                });
            }
        }

        return groups;
    }
}
