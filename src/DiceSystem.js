export class DiceSystem {

    //setting scoping is currently useless as there's no good way for the user to set a "local" setting if they are not using this dice set
    //keeping this for future use
    static SETTING_SCOPE = {
        LOCAL: 0, // User specific settings that is not shared with other players
        SHARED: 1 // User specific settings that is shared with other players
    }

    static SETTING_TYPE = {
        BOOLEAN: "boolean",
        SELECT: "select",
        COLOR: "color",
        FILE: "file",
        RANGE: "range",
        STRING: "string"
    }

    static SETTING_FORMATING = {
        SEPARATOR: "separator",
        HTML: "html"
    }

    static DICE_EVENT_TYPE = {
        SPAWN: 0,
        CLICK: 1,
        RESULT: 2,
        COLLIDE: 3, //not implemented, risk of performance impact 
        DESPAWN: 4 //not implemented. need a use-case. "result" seems to be the enough for despawning animations
    }

    static generateHash = (str) => {
        let hash = 0,
            i, chr;
        if (str.length === 0) return hash;
        for (i = 0; i < str.length; i++) {
            chr = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0;
        }
        return hash;
    }

    /**
     * Creates a new instance of the DiceSystem class.
     *
     * @param {string} id - The unique identifier for the dice system.
     * @param {string} name - The name of the dice system.
     * @param {Map} [dice=null] - A map of dice for the dice system.
     * @param {string} [mode="default"] - The mode of the dice system.
     * @param {string|null} [group=null] - The group the dice system belongs to.
     */
    constructor(id, name, mode = "default", group = null) {
        this._id = id;
        this._name = name;
        this._dice = new DiceMap(this);
        this._mode = mode;
        this._group = group;

        this._settings = [];
        this._scopedSettings = new Map();

        this._listeners = [];

        this._registeredProcessMaterialCallbacks = [];
        this._registeredBeforeShaderCompileCallbacks = [];
    }

    get id() {
        return this._id;
    }

    get name() {
        return this._name;
    }

    get dice() {
        return this._dice;
    }

    get mode() {
        return this._mode;
    }

    get group() {
        return this._group;
    }

    get settings() {
        const objValues = Object.values(DiceSystem.SETTING_TYPE);
        return this._settings.filter((setting) => objValues.includes(setting.type));
    }

    on(eventType, listener) {
        if(!Object.values(DiceSystem.DICE_EVENT_TYPE).includes(eventType))
            throw new Error(`[DiceSystem.fire] Invalid dice event type: ${eventType}`);

        if (!this._listeners[eventType]) {
            this._listeners[eventType] = [];
        }
        this._listeners[eventType].push(listener);
    }

    off(eventType, listener) {
        if (!this._listeners[eventType]) return;

        const index = this._listeners[eventType].indexOf(listener);
        if (index > -1) {
            this._listeners[eventType].splice(index, 1);
        }
    }

    fire(eventType, event) {
        if(!Object.values(DiceSystem.DICE_EVENT_TYPE).includes(eventType))
            throw new Error(`[DiceSystem.fire] Invalid dice event type: ${eventType}`);

        this._dispatchEvent(eventType, event);
    }

    _dispatchEvent(eventType, event) {
        if (!this._listeners[eventType]) return;

        for (const listener of this._listeners[eventType]) {
            listener(event);
        }
    }

    getSettingsByDiceType(diceType) {
        return this._scopedSettings.get(diceType) || this._scopedSettings.get("global");
    }

    getCacheString(appearance) {
        return this.id+JSON.stringify(Object.values(appearance));
    }

    processMaterial(diceType, material, appearance) {
        if(this.dice.has(diceType)) {
            for(const callback of this._registeredProcessMaterialCallbacks) {
                callback(diceType, material, appearance);
            }

            material.userData.diceType = diceType;
            material.userData.system = this.id;
            material.userData.appearance = appearance;
        }
        return material;
    }

    beforeShaderCompile(shader, material) {
        let fragmentShader = shader.fragmentShader;
        let vertexShader = shader.vertexShader;
 
        for(const callback of this._registeredBeforeShaderCompileCallbacks) {
            callback(shader, material, material.userData.diceType, material.userData.appearance);
        }

        material.userData.shaderCacheKey = DiceSystem.generateHash(shader.fragmentShader+shader.vertexShader);

        if(fragmentShader != shader.fragmentShader || vertexShader != shader.vertexShader) {
            material.customProgramCacheKey = () => {
                return material.userData.shaderCacheKey;
            }
            material.needsUpdate = true;
        }
    }

    /**
     * Registers a callback to be called when a material is processed for a dice of this system.
     * The callback will be called with the diceType, material and appearance as arguments.
     * @param {function} callback - The callback to be called.
     */
    registerProcessMaterialCallback(callback) {
        this._registeredProcessMaterialCallbacks.push(callback);
    }
    
    /**
     * Registers a callback to be called when a shader is compiled for a dice of this system.
     * The callback will be called with the shader, material and appearance as arguments.
     * @param {function} callback - The callback to be called.
     */
    registerBeforeShaderCompileCallback(callback) {
        this._registeredBeforeShaderCompileCallbacks.push(callback);
    }

    updateSettings(diceType = "global", settings) {
        this._scopedSettings.set(diceType, {...settings});
    }

    loadSettings() {
        this._scopedSettings = new Map();
        //called after the system is added to the dice factory
        //check for saved settings and load them
        const savedSettings = game.user.getFlag("dice-so-nice", "appearance");

        //set default settings (just key/value pairs)
        const defaultSettings = this.settings.reduce((acc, { id, defaultValue }) => ({ ...acc, [id]: defaultValue }), {});
        this._scopedSettings.set("global", defaultSettings);

        if(savedSettings) {
            for(let diceType of Object.keys(savedSettings)) {
                if(savedSettings[diceType].system === this.id) {
                    this._scopedSettings.set(diceType, {...savedSettings[diceType].systemSettings});
                }
            }
        }
    }

    /**
     * Creates a setting object with the specified type, id, name, scope, value, and additional properties.
     *
     * @param {string} type - The type of the setting.
     * @param {string} id - The unique identifier of the setting.
     * @param {string} name - The name of the setting.
     * @param {string} scope - The scope of the setting.
     * @param {any} value - The value of the setting.
     * @param {Object} [additionalProperties={}] - Additional properties to be added to the setting object.
     * @return {Object} The created setting object.
     */
    _createSetting(type, id, name, scope, defaultValue, additionalProperties = {}) {
        //field checks
        if (!Object.values(DiceSystem.SETTING_TYPE).includes(type) && !Object.values(DiceSystem.SETTING_FORMATING).includes(type)) {
            throw new Error(`[DiceSystem._createSetting] Invalid setting type: ${type}`);
        }

        if (!Object.values(DiceSystem.SETTING_SCOPE).includes(scope) && !Object.values(DiceSystem.SETTING_SCOPE).includes(scope)) {
            throw new Error(`[DiceSystem._createSetting] Invalid setting scope: ${scope}`);
        }

        if (DiceSystem.SETTING_TYPE.hasOwnProperty(type)) {
            if (!id) {
                throw new Error(`[DiceSystem._createSetting] Invalid setting id: ${id}`);
            }

            if (!name) {
                throw new Error(`[DiceSystem._createSetting] Invalid setting name: ${name}`);
            }
        }

        this._settings.push({
            type,
            id,
            name,
            defaultValue,
            scope: scope,
            ...additionalProperties
        });
    }

    /**
     * Adds a visual separator with an optional title.
     *
     * @param {Object} args - The options for the separator.
     * @param {string} [args.name=""] - The title to display
     * @return {void}
     */
    addSettingSeparator({ name = "" } = {}) {
        this._createSetting("separator", null, name, DiceSystem.SETTING_SCOPE.LOCAL, null);
    }

    addSettingHTML({ name }) {
        this._createSetting("html", null, name, DiceSystem.SETTING_SCOPE.LOCAL, null);
    }

    /**
     * Adds a boolean setting
     *
     * @param {Object} args - The arguments object.
     * @param {string} args.id - The unique identifier for the setting.
     * @param {string} args.name - The name of the setting.
     * @param {string} args.scope - The scope of the setting.
     * @param {boolean} [args.defaultValue=false] - The default value of the setting.
     * @return {void}
     */
    addSettingBoolean({ id, name, scope = DiceSystem.SETTING_SCOPE.SHARED, defaultValue = false }) {
        this._createSetting("boolean", id, name, scope, defaultValue);
    }

    /**
     * Adds a color setting
     *
     * @param {Object} args - The arguments object.
     * @param {string} args.id - The unique identifier for the setting.
     * @param {string} args.name - The name of the setting.
     * @param {string} args.scope - The scope of the setting.
     * @param {string} [args.defaultValue=null] - The default value of the setting, in hex format, e.g. "#ffffff".
     * @return {void}
     */
    addSettingColor({ id, name, scope = DiceSystem.SETTING_SCOPE.SHARED, defaultValue = "#ffffff" }) {
        this._createSetting("color", id, name, scope, defaultValue);
    }

    /**
     * Adds a range setting
     *
     * @param {Object} args - The arguments object.
     * @param {string} args.id - The unique identifier for the setting.
     * @param {string} args.name - The name of the setting.
     * @param {string} args.scope - The scope of the setting.
     * @param {number} [args.defaultValue=0] - The default value of the setting.
     * @param {number} [args.min=0] - The minimum value of the setting.
     * @param {number} [args.max=100] - The maximum value of the setting.
     * @param {number} [args.step=1] - The step value of the setting.
     * @return {void}
     */
    addSettingRange({ id, name, scope = DiceSystem.SETTING_SCOPE.SHARED, defaultValue = 0, min = 0, max = 100, step = 1 }) {
        this._createSetting("range", id, name, scope, defaultValue, { min, max, step });
    }

    /**
     * Adds a file setting
     *
     * @param {Object} args - The arguments object.
     * @param {string} args.id - The unique identifier for the setting.
     * @param {string} args.name - The name of the setting.
     * @param {string} args.scope - The scope of the setting.
     * @param {string|null} [args.defaultValue=null] - The default value of the setting.
     * @return {void}
     */
    addSettingFile({ id, name, scope = DiceSystem.SETTING_SCOPE.SHARED, defaultValue = "" }) {
        // Make sure defaultValue is a string)
        defaultValue = defaultValue || "";
        this._createSetting("file", id, name, scope, defaultValue);
    }

    /**
     * Adds a select setting
     *
     * @param {Object} args - The arguments object.
     * @param {string} args.id - The unique identifier for the setting.
     * @param {string} args.name - The name of the setting.
     * @param {string} args.scope - The scope of the setting.
     * @param {string|null} [args.defaultValue=null] - The default value of the setting.
     * @param {Object} [args.options={}] - The options for the select setting.
     * @param {string} args.options.id - The unique identifier for the option.
     * @param {string} args.options.label - The label for the option.
     * @param {string} [args.options.group=null] - The group for the option.
     * @return {void}
     */
    addSettingSelect({ id, name, scope = DiceSystem.SETTING_SCOPE.SHARED, defaultValue = null, options = {} }) {
        this._createSetting("select", id, name, scope, defaultValue, { options });
    }

    /**
     * Adds a string setting.
     *
     * @param {Object} options - The options for the setting.
     * @param {string} options.id - The unique identifier for the setting.
     * @param {string} options.name - The name of the setting.
     * @param {string} options.scope - The scope of the setting.
     * @param {string|null} [options.defaultValue=null] - The default value of the setting.
     * @return {void}
     */
    addSettingString({ id, name, scope = DiceSystem.SETTING_SCOPE.SHARED, defaultValue = "" }) {
        // Make sure defaultValue is a string
        defaultValue = defaultValue || "";
        this._createSetting("string", id, name, scope, defaultValue);
    }

    /**
     * Retrieves a dice object from the dice array based on the given shape and values.
     *
     * @param {string} shape - The shape of the dice.
     * @param {Array} values - The values of the dice.
     * @return {Object|null} The dice object if found, or null if not found.
     */
    getDiceByShapeAndValues(shape, values) {
        for (let dice of this.dice.values()) {
            if (dice.shape == shape && dice.values.length == values.length) {
                return dice;
            }
        }
        return null;
    }

    /**
     * Retrieves the value of a scoped setting for a specific dice type.
     *
     * @param {string} diceType - The type of the dice.
     * @param {string} settingId - The ID of the setting.
     * @return {any} The value of the scoped setting, or the default value if not found.
     */
    getScopedSettingValue(diceType, settingId) {
        return this._scopedSettings.get(diceType)?.[settingId] ?? this._scopedSettings.get("global")?.[settingId];
    }

    /**
     * Generates the HTML content and data for a settings dialog line based on the provided setting.
     *
     * @param {Object} setting - The setting object containing the type, id, name, and value.
     * @param {string} diceType - The type of the dice or "global"
     * @return {Object} An object containing the HTML content and data for the settings dialog line.
     */
    getSettingsDialogLine(setting, diceType) {
        let line = {
            content: "",
            data: {}
        };
        switch (setting.type) {
            case DiceSystem.SETTING_TYPE.BOOLEAN:
                line.content = `
                    <div class="form-group">
                        <label>${setting.name}</label>
                        <div class="form-fields">
                            <input type="checkbox" name="appearance[${diceType}][systemSettings][${setting.id}]" data-dtype="Boolean" {{checked ${setting.id}.value}} />
                        </div>
                    </div>
                `;

                line.data = {
                    value: this.getScopedSettingValue(diceType, setting.id)
                };
                break;
            case DiceSystem.SETTING_TYPE.STRING:
                line.content = `
                    <div class="form-group">
                        <label>${setting.name}</label>
                        <div class="form-fields">
                            <input type="text" name="appearance[${diceType}][systemSettings][${setting.id}]" value="{{${setting.id}.value}}" data-dtype="String" />
                        </div>
                    </div>
                `;

                line.data = {
                    value: this.getScopedSettingValue(diceType, setting.id)
                };
                break;
            case DiceSystem.SETTING_TYPE.COLOR:
                line.content = `
                    <div class="form-group">
                        <label>${setting.name}</label>
                        <div class="form-fields">
                            <input type="text" data-colorpicker name="appearance[${diceType}][systemSettings][${setting.id}]" value="{{${setting.id}.value}}" data-dtype="String" />
                            <input type="color" name="appearance[${diceType}][systemSettings][${setting.id}Selector]" value="{{${setting.id}.value}}"
                                data-edit="appearance[${diceType}][systemSettings][${setting.id}]" data-${setting.id}Selector />
                        </div>
                    </div>
                `;

                line.data = {
                    value: this.getScopedSettingValue(diceType, setting.id)
                };
                break;
            case DiceSystem.SETTING_TYPE.RANGE:
                line.content = `
                    <div class="form-group">
                        <label>${setting.name}</label>
                        <div class="form-fields">
                            <input type="range" name="appearance[${diceType}][systemSettings][${setting.id}]" value="{{${setting.id}.value}}" min="{{${setting.id}.min}}" max="{{${setting.id}.max}}" step="{{${setting.id}.step}}" data-dtype="Number">
                            <span class="range-value">{{${setting.id}.value}}</span>
                        </div>
                    </div>
                `;

                line.data = {
                    value: this.getScopedSettingValue(diceType, setting.id),
                    min: setting.min,
                    max: setting.max,
                    step: setting.step
                };
                break;
            case DiceSystem.SETTING_TYPE.FILE:
                line.content = `
                    <div class="form-group">
                        <label>${setting.name}</label>
                        <div class="form-fields">
                            <input type="file" name="appearance[${diceType}][systemSettings][${setting.id}]" value="{{${setting.id}.value}}"
                                data-edit="appearance[${diceType}][systemSettings][${setting.id}]" data-${setting.id} />
                        </div>
                    </div>
                `;

                line.data = {
                    value: this.getScopedSettingValue(diceType, setting.id)
                };
                break;
            case DiceSystem.SETTING_TYPE.SELECT:
                line.content = `
                    <div class="form-group">
                        <label>${setting.name}</label>
                        <div class="form-fields">
                            <select name="appearance[${diceType}][systemSettings][${setting.id}]" data-dtype="String">
                                {{selectOptions ${setting.id}.options selected=${setting.id}.value}}
                            </select>
                        </div>
                    </div>
                `;

                line.data = {
                    value: this.getScopedSettingValue(diceType, setting.id),
                    options: setting.options
                };
                break;
            case DiceSystem.SETTING_FORMATING.SEPARATOR:
                if (setting.name != "")
                    line.content = `<h2>${setting.name}</h2>`;
                else
                    line.content = `<hr />`;
                break;
            case DiceSystem.SETTING_FORMATING.HTML:
                line.content = setting.name;
                break;
        }

        return line;
    }

    getSettingsDialogContent(diceType) {
        let dialogContent = {
            content: "",
            data: {}
        };

        if (!this._settings.length) return dialogContent;

        // generate the content and data for each setting
        for (let setting of this._settings) {
            let line = this.getSettingsDialogLine(setting, diceType);
            dialogContent.content += line.content;
            dialogContent.data[setting.id] = line.data;
        }

        dialogContent.content = `<div data-systemSettings="${this.id}">${dialogContent.content}</div>`;

        return dialogContent;
    }

    getDefaultSettings() {
        let settings = this.settings;
        let defaultSettings = {};

        for (let setting of settings) {
            defaultSettings[setting.id] = setting.defaultValue;
        }

        return defaultSettings;
    }
}

class DiceMap extends Map {
    constructor(diceSystem, ...args) {
        super(...args);
        this._diceSystem = diceSystem;
    }
    set(key, value) {
        if (!this.has(key)) {
            // Set the DiceSystem object as the value of value.diceSystem
            value.diceSystem = this._diceSystem;
        }
        return super.set(key, value);
    }
}
