import { DicePreset } from './DicePreset.js';
import { DICE_SHAPE } from './DiceModels.js';

/**
 * Manages custom dice term registration, preset creation, and synchronization.
 */
export class CustomDiceTerms {

    static _registeredDenominations = new Set();

    static getValidShapes() {
        return Object.keys(DICE_SHAPE);
    }

    static getShapeFaceCount(shape) {
        return parseInt(shape.substring(1), 10) || 0;
    }

    static getRegisteredDenominations() {
        return new Set(this._registeredDenominations);
    }

    static registerSetting() {
        game.settings.register("dice-so-nice", "customDiceTerms", {
            scope: "world",
            config: false,
            type: Object,
            default: {}
        });
    }

    static loadAndRegisterAll() {
        const definitions = game.settings.get("dice-so-nice", "customDiceTerms") ?? {};
        for (const [denomination, definition] of Object.entries(definitions)) {
            try {
                this._registerSingleTerm(denomination, definition);
            } catch (err) {
                console.error(`[Dice So Nice] Failed to register custom DiceTerm "${denomination}":`, err);
            }
        }
    }

    static registerPresetsInFactory(diceFactory) {
        const definitions = game.settings.get("dice-so-nice", "customDiceTerms") ?? {};
        for (const [denomination, definition] of Object.entries(definitions)) {
            try {
                this._registerSinglePreset(denomination, definition, diceFactory);
            } catch (err) {
                console.error(`[Dice So Nice] Failed to register custom DicePreset "d${denomination}":`, err);
            }
        }
    }

    static sync(definitions, diceFactory) {
        this._unregisterAll(diceFactory);
        for (const [denomination, definition] of Object.entries(definitions)) {
            try {
                this._registerSingleTerm(denomination, definition);
                if (diceFactory) {
                    this._registerSinglePreset(denomination, definition, diceFactory);
                }
            } catch (err) {
                console.error(`[Dice So Nice] Failed to sync custom DiceTerm "${denomination}":`, err);
            }
        }
    }

    static async applyDefaultAppearances() {
        const definitions = game.settings.get("dice-so-nice", "customDiceTerms") ?? {};
        const appearance = game.user.getFlag("dice-so-nice", "appearance") ?? {};
        const updates = {};

        for (const [denomination, def] of Object.entries(definitions)) {
            if (!def.defaultDieId || !def.defaultDieOwner) continue;
            const dieType = "d" + denomination;
            if (appearance[dieType] !== undefined) continue;
            updates[dieType] = {
                libraryDieId: def.defaultDieId,
                libraryDieOwner: def.defaultDieOwner
            };
        }

        if (Object.keys(updates).length > 0) {
            const merged = foundry.utils.mergeObject(
                foundry.utils.deepClone(appearance),
                updates
            );
            await game.user.setFlag("dice-so-nice", "appearance", merged);
        }
    }

    static unregisterTerm(denomination, diceFactory) {
        delete CONFIG.Dice.terms[denomination];
        this._registeredDenominations.delete(denomination);
        const type = "d" + denomination;
        if (diceFactory) {
            diceFactory.systems.get("standard").dice.delete(type);
            diceFactory.disposeCachedMaterials(type);
        }
        const appearance = game.user.getFlag("dice-so-nice", "appearance");
        if (appearance?.[type] !== undefined) {
            const cleaned = foundry.utils.deepClone(appearance);
            delete cleaned[type];
            game.user.setFlag("dice-so-nice", "appearance", cleaned);
        }
    }

    static isDenominationValid(denomination, excludeExisting = null) {
        if (!denomination || typeof denomination !== "string") return false;
        if (!/^[a-z]$/.test(denomination)) return false;
        if (excludeExisting && denomination === excludeExisting) return true;
        return !CONFIG.Dice.terms[denomination];
    }

    static createTermClass(definition) {
        const faces = definition.faces;
        const faceCount = faces.length;
        const denomination = definition.denomination;

        const minValue = Math.min(...faces.map(f => f.value));
        const maxValue = Math.max(...faces.map(f => f.value));

        const cls = class CustomDiceTerm extends foundry.dice.terms.DiceTerm {
            constructor(termData = {}) {
                termData.faces = faceCount;
                super(termData);
            }

            static DENOMINATION = denomination;
            static _dsnCustomTerm = true;

            randomFace() {
                const idx = Math.floor(CONFIG.Dice.randomUniform() * faceCount);
                return faces[idx].value;
            }

            async roll({ minimize = false, maximize = false, ...options } = {}) {
                const roll = { result: undefined, active: true };
                if (minimize) roll.result = minValue;
                else if (maximize) roll.result = maxValue;
                else roll.result = this.randomFace();
                this.results.push(roll);
                return roll;
            }

            _evaluateSync(options = {}) {
                if (this._faces instanceof Roll) this._faces.evaluateSync(options);
                if (this._number instanceof Roll) this._number.evaluateSync(options);
                for (let n = this.results.length; n < Math.abs(this.number); n++) {
                    const roll = { active: true };
                    if (options.minimize) roll.result = minValue;
                    else if (options.maximize) roll.result = maxValue;
                    else if (options.strict) throw new Error("Cannot synchronously evaluate a non-deterministic term.");
                    else roll.result = this.randomFace();
                    this.results.push(roll);
                }
                return this;
            }

            getResultLabel(result) {
                return String(result.result);
            }
        };

        Object.defineProperty(cls, "name", { value: `CustomDiceTerm_${denomination}` });
        return cls;
    }

    static createPreset(definition, diceFactory) {
        const type = "d" + definition.denomination;
        const shape = definition.shape;
        const faces = definition.faces;

        const basePreset = diceFactory.systems.get("standard").dice.get(shape);
        if (!basePreset) {
            console.warn(`[Dice So Nice] No base preset found for shape "${shape}"`);
            return null;
        }

        const preset = new DicePreset(type, shape);
        preset.term = `CustomDiceTerm_${definition.denomination}`;

        const labels = faces.map(f => String(f.value));
        preset.setLabels(labels);

        const values = faces.map(f => f.value);
        preset.values = values;

        const hasNonStandard = values.some((v, i) => v !== i + 1);
        if (hasNonStandard) {
            const valueMap = {};
            for (let i = 0; i < values.length; i++) {
                if (valueMap[values[i]] === undefined) {
                    valueMap[values[i]] = i + 1;
                }
            }
            preset.valueMap = valueMap;
        }

        preset.mass = basePreset.mass;
        preset.inertia = basePreset.inertia;
        preset.scale = basePreset.scale;
        preset.internalAdd = false;

        return preset;
    }

    static _registerSingleTerm(denomination, definition) {
        const cls = this.createTermClass(definition);
        CONFIG.Dice.terms[denomination] = cls;
        this._registeredDenominations.add(denomination);
    }

    static _registerSinglePreset(denomination, definition, diceFactory) {
        const preset = this.createPreset(definition, diceFactory);
        if (preset) {
            diceFactory.register(preset);
        }
    }

    static _unregisterAll(diceFactory) {
        for (const denomination of this._registeredDenominations) {
            delete CONFIG.Dice.terms[denomination];
            if (diceFactory) {
                const type = "d" + denomination;
                diceFactory.systems.get("standard").dice.delete(type);
                diceFactory.disposeCachedMaterials(type);
            }
        }
        this._registeredDenominations.clear();
    }
}
