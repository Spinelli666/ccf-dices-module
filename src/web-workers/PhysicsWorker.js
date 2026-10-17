import { World, Material, NaiveBroadphase, ContactMaterial, Body, Plane, Vec3, Sphere, PointToPointConstraint, Cylinder, ConvexPolyhedron } from 'cannon-es';
import { DICE_SHAPE } from '../engine/DiceModels.js';
import { Vector3 } from 'three';
import { LEGACY_TO_METERS } from '../engine/SceneConstants.js';
import RegisterPromise from 'webworker-promise/lib/register';

//cannon-es only behaves well at legacy scale (~1000x meters), so the worker
//runs internally at legacy scale. callers speak meters, conversion at I/O boundary.
const METERS_TO_LEGACY = 1 / LEGACY_TO_METERS;

const DEBUG_SIMULATION_PERF = false;

class PhysicsWorker {
    constructor() {
        this.shapeList = new Map();
        this.host = RegisterPromise()
            .operation('init', this.init.bind(this))
            .operation('addConstraint', this.addConstraint.bind(this))
            .operation('removeConstraint', this.removeConstraint.bind(this))
            .operation('updateConstraint', this.updateConstraint.bind(this))
            .operation('createShape', this.createShape.bind(this))
            .operation('getDiceValue', this.getDiceValue.bind(this))
            .operation('createDice', this.createDice.bind(this))
            .operation('createDiceBatch', this.createDiceBatch.bind(this))
            .operation('removeDice', this.removeDice.bind(this))
            .operation('addDice', this.addDice.bind(this))
            .operation('applyImpulse', this.applyImpulse.bind(this))
            .operation('getBodyQuaternion', this.getBodyQuaternion.bind(this))
            .operation('setBodyPosition', this.setBodyPosition.bind(this))
            .operation('setBodyPositions', this.setBodyPositions.bind(this))
            .operation('playStep', this.playStep.bind(this))
            .operation('simulateThrow', this.simulateThrow.bind(this))

            .operation('updateBarriers', this.updateBarriers.bind(this))
            .operation('getWorldInfo', this.getWorldInfo.bind(this))
            .operation('setCollisionResponse', this.setCollisionResponse.bind(this));
    }

    /**
     * Initialize the physics simulation
     */
    init(data) {
        this.world = new World();
        this.dice_body_material = new Material();
        this.desk_body_material = new Material();
        this.barrier_body_material = new Material();

        this.soundDelay = 2; // time between sound effects in worldstep
        this.animstate = 'throw';

        this.diceConstraints = new Map();

        this.diceList = new Map();

        this.world.gravity.set(0, -9.8 * 800, 0);
        this.world.broadphase = new NaiveBroadphase();
        this.world.solver.iterations = 14;
        this.world.allowSleep = true;

        this.muteSoundSecretRolls = data.muteSoundSecretRolls;

        this.framerate = 1 / 60;

        this.addContactMaterials();
        this.addDesk();
        this.addBarriers(
            data.height * METERS_TO_LEGACY,
            data.width * METERS_TO_LEGACY,
            {
                top: data.margin.top * METERS_TO_LEGACY,
                bottom: data.margin.bottom * METERS_TO_LEGACY,
                left: data.margin.left * METERS_TO_LEGACY,
                right: data.margin.right * METERS_TO_LEGACY
            }
        );
        this.reset();
        //reset sets animstate='simulate' but no sim is running after init, so allow playStep
        this.animstate = 'throw';
    }

    /**
     * Adds contact materials between different body materials with the specified
     * friction and restitution options.
     */
    addContactMaterials() {
        const contactMaterials = [
            { materials: [this.desk_body_material, this.dice_body_material], options: { friction: 0.01, restitution: 0.5 } },
            { materials: [this.barrier_body_material, this.dice_body_material], options: { friction: 0, restitution: 0.95 } },
            { materials: [this.dice_body_material, this.dice_body_material], options: { friction: 0.01, restitution: 0.7 } }
        ];

        for (const { materials, options } of contactMaterials) {
            const contactMaterial = new ContactMaterial(...materials, options);
            this.world.addContactMaterial(contactMaterial);
        }
    }

    /**
     * Adds a static desk body to the world simulation with the desk_body_material.
     */
    addDesk() {
        const desk = new Body({ allowSleep: false, mass: 0, shape: new Plane(), material: this.desk_body_material });
        //rotate default +Z normal to +Y so the plane lies flat
        desk.quaternion.setFromAxisAngle(new Vec3(1, 0, 0), -Math.PI / 2);
        this.world.addBody(desk);
    }

    /**
     * Adds barriers around the world simulation to keep dice within bounds.
     */
    addBarriers(height, width, margin) {
        this.barriers = [];
        this.barriersScale = 0.97;
        //four walls around the desk: +Z, -Z, +X, -X
        const barriersConfig = [
            { axis: new Vec3(1, 0, 0), angle: Math.PI, position: new Vec3(0, 0, (height - margin.top * 2) * this.barriersScale) },
            { axis: new Vec3(1, 0, 0), angle: 0, position: new Vec3(0, 0, (-height + margin.bottom * 2) * this.barriersScale) },
            { axis: new Vec3(0, 1, 0), angle: -Math.PI / 2, position: new Vec3((width - margin.right * 2) * this.barriersScale, 0, 0) },
            { axis: new Vec3(0, 1, 0), angle: Math.PI / 2, position: new Vec3((-width + margin.left * 2) * this.barriersScale, 0, 0) }
        ];

        for (const { axis, angle, position } of barriersConfig) {
            const barrier = new Body({ allowSleep: false, mass: 0, shape: new Plane(), material: this.barrier_body_material });
            barrier.quaternion.setFromAxisAngle(axis, angle);
            barrier.position.copy(position);
            this.world.addBody(barrier);
            this.barriers.push(barrier);
        }
    }

    /**
     * Updates the positions of the barriers based on new world dimensions.
     */
    updateBarriers({height, width, margin}) {
        const h = height * METERS_TO_LEGACY;
        const w = width * METERS_TO_LEGACY;
        const mt = margin.top * METERS_TO_LEGACY;
        const mb = margin.bottom * METERS_TO_LEGACY;
        const mr = margin.right * METERS_TO_LEGACY;
        const ml = margin.left * METERS_TO_LEGACY;
        this.barriers[0].position.set(0, 0, (h - mt * 2) * this.barriersScale);
        this.barriers[1].position.set(0, 0, (-h + mb * 2) * this.barriersScale);
        this.barriers[2].position.set((w - mr * 2) * this.barriersScale, 0, 0);
        this.barriers[3].position.set((-w + ml * 2) * this.barriersScale, 0, 0);
    }

    //create a joint body for a held die, one per addConstraint call
    _createJointBody() {
        const shape = new Sphere(0.1);
        const joint = new Body({ mass: 0 });
        joint.addShape(shape);
        joint.collisionFilterGroup = 0;
        joint.collisionFilterMask = 0;
        this.world.addBody(joint);
        return joint;
    }

    /**
     * Adds a dice to the world simulation with the dice_body_material.
     */
    createDice({id, shape, material, vectordata, mass, startAtIteration, options}) {
        const resolvedShape = this.shapeList.get(shape);
        const body = new Body({ allowSleep: true, sleepSpeedLimit: 75, sleepTimeLimit: 0.9, mass: mass, shape: resolvedShape, material: this.dice_body_material });
        body.type = Body.DYNAMIC;
        body.position.set(vectordata.pos.x * METERS_TO_LEGACY, vectordata.pos.y * METERS_TO_LEGACY, vectordata.pos.z * METERS_TO_LEGACY);
        body.quaternion.setFromAxisAngle(new Vec3(vectordata.axis.x, vectordata.axis.y, vectordata.axis.z), vectordata.axis.a * Math.PI * 2);
        body.angularVelocity.set(vectordata.angle.x, vectordata.angle.y, vectordata.angle.z);
        body.velocity.set(vectordata.velocity.x * METERS_TO_LEGACY, vectordata.velocity.y * METERS_TO_LEGACY, vectordata.velocity.z * METERS_TO_LEGACY);
        body.linearDamping = 0.1;
        body.angularDamping = 0.1;
        body.addEventListener('collide', this.eventCollide.bind(this));

        //We add some informations about the dice to the CANNON body to be used in the collide event
        body.diceType = vectordata.type;
        body.diceShape = shape;
        body.diceMaterial = material;
        body.secretRoll = options?.secret ?? false;
        body.persistent = options?.persistent ?? false;
        body.startAtIteration = startAtIteration;

        this.diceList.set(id, body);
    }

    createDiceBatch(specs) {
        const addToWorld = [];
        for (const spec of specs) {
            this.createDice(spec);
            if (spec.startAtIteration === 0) addToWorld.push(spec.id);
        }
        for (const id of addToWorld) {
            this.world.addBody(this.diceList.get(id));
        }
    }

    addDice(id) {
        const dice = this.diceList.get(id);
        this.world.addBody(dice);
    }

    removeDice(ids) {
        for (const id of ids) {
            //clean up any active constraint before removing the body
            const entry = this.diceConstraints.get(id);
            if (entry) {
                this.world.removeConstraint(entry.constraint);
                this.world.removeBody(entry.joint);
                this.diceConstraints.delete(id);
            }

            const dice = this.diceList.get(id);
            this.world.removeBody(dice);

            this.diceList.delete(id);
        }
        //wake survivors so they react to removed supports
        for (const [, dice] of this.diceList) dice.wakeUp();
    }

    applyImpulse({id, velocity, angularVelocity}) {
        const dice = this.diceList.get(id);
        if (!dice) return;

        dice.result = null;
        dice.wakeUp();
        dice.type = Body.DYNAMIC;
        dice.velocity.set(velocity.x * METERS_TO_LEGACY, velocity.y * METERS_TO_LEGACY, velocity.z * METERS_TO_LEGACY);
        dice.angularVelocity.set(angularVelocity.x, angularVelocity.y, angularVelocity.z);
    }

    getBodyQuaternion(id) {
        const dice = this.diceList.get(id);
        if (!dice) return null;
        return {
            x: dice.quaternion.x,
            y: dice.quaternion.y,
            z: dice.quaternion.z,
            w: dice.quaternion.w
        };
    }

    setBodyPosition({ id, position }) {
        const dice = this.diceList.get(id);
        if (!dice) return;
        dice.position.set(position.x * METERS_TO_LEGACY, position.y * METERS_TO_LEGACY, position.z * METERS_TO_LEGACY);
        dice.velocity.set(0, 0, 0);
        dice.angularVelocity.set(0, 0, 0);
    }

    //batch setBodyPosition to avoid N worker messages per frame
    setBodyPositions({ updates }) {
        for (const { id, position } of updates) {
            const dice = this.diceList.get(id);
            if (!dice) continue;
            dice.position.set(position.x * METERS_TO_LEGACY, position.y * METERS_TO_LEGACY, position.z * METERS_TO_LEGACY);
            dice.velocity.set(0, 0, 0);
            dice.angularVelocity.set(0, 0, 0);
        }
    }

    setCollisionResponse({ ids, enabled }) {
        for (const id of ids) {
            const body = this.diceList.get(id);
            if (body) body.collisionResponse = enabled;
        }
    }

    cleanAfterThrow() {
        //no-op: dynamic tracking allocates per-sim buffers, nothing to reset on bodies
    }

    /**
     * Collide event handler for dice bodies.
     */
    eventCollide({ body, target }) {
        if (!body) return;
        //skip phantom collisions involving ghostified (no collision response) bodies
        if (body.collisionResponse === false || target.collisionResponse === false) return;

        const now = body.world.stepnumber;
        const currentSoundType = body.mass > 0 ? 'dice' : 'table';

        if (this.shouldSkipSound(now, currentSoundType)) return;

        if (body.mass > 0) { // dice to dice collision
            this.handleDiceCollision(body, target);
        } else { // dice to table collision
            this.handleTableCollision(body, target);
        }

        this.updateLastSound(now);
    }

    /**
     * Determines if the sound should be skipped based on the current world step and sound type.
     */
    shouldSkipSound(now, currentSoundType) {
        const soundPlayedThisStep = this.lastSoundStep === now;
        const notEnoughDelay = this.lastSound > now;

        if (soundPlayedThisStep || notEnoughDelay) {
            const sameSoundType = currentSoundType === 'dice' && this.lastSoundType === 'dice';
            return !(currentSoundType !== 'dice') || sameSoundType;
        }
        return false;
    }

    /**
     * Handles dice to dice collision and plays appropriate sound.
     */
    handleDiceCollision(body, target) {
        const speed = body.velocity.length();
        if (speed < 250) return;

        const strength = this.calculateStrength(speed, 550, 0.2);
        const shouldMute = this.muteSoundSecretRolls && (body.secretRoll || target.secretRoll);
        const finalStrength = shouldMute ? 0 : strength;

        if (this.animstate === "simulate") {
            this.detectedCollides[this.iteration] = ["dice", body.diceType, body.diceMaterial, finalStrength];
        } else {
            this.host.emit("collide", { source: "dice", type: body.diceType, material: body.diceMaterial, strength: finalStrength });
        }
        this.lastSoundType = 'dice';
    }

    /**
     * Handles dice to table collision and plays appropriate sound.
     */
    handleTableCollision(body, target) {
        const speed = target.velocity.length();
        if (speed < 100) return;

        const strength = this.calculateStrength(speed, 500, 0.2);
        const shouldMute = this.muteSoundSecretRolls && (body.secretRoll || target.secretRoll);
        const finalStrength = shouldMute ? 0 : strength;

        if (this.animstate === "simulate") {
            this.detectedCollides[this.iteration] = ["table", null, null, finalStrength];
        } else {
            this.host.emit("collide", { source: "table", type: null, material: null, strength: finalStrength });
        }

        this.lastSoundType = 'table';
    }

    /**
     * Calculates the strength of the sound based on the speed, max speed, and minimum strength.
     */
    calculateStrength(speed, maxSpeed, minStrength) {
        return Math.max(Math.min(speed / maxSpeed, 1), minStrength);
    }

    /**
     * Updates the last sound step and last sound properties based on the current world step.
     */
    updateLastSound(now) {
        this.lastSoundStep = now;
        this.lastSound = now + this.soundDelay;
    }

    addConstraint({id, pos}){
        const dice = this.diceList.get(id);
        if (!dice) return;

        //idempotent: already constrained, just reposition
        if (this.diceConstraints.has(id)) {
            return this.updateConstraint({ positions: { [id]: pos } });
        }

        //disable sleep while held so the constraint solver stays active
        const prevAllowSleep = dice.allowSleep;
        dice.allowSleep = false;
        dice.wakeUp();

        const lx = pos.x * METERS_TO_LEGACY;
        const ly = pos.y * METERS_TO_LEGACY;
        const lz = pos.z * METERS_TO_LEGACY;

        //persistent = center pivot, ephemeral = click-point pivot
        let pivot;
        let anchorPos;
        if (dice.persistent) {
            pivot = new Vec3(0, 0, 0);
            //keep current xz so pickup doesn't teleport, lift to caller's y
            anchorPos = { x: dice.position.x, y: ly, z: dice.position.z };
        } else {
            let v1 = new Vec3(lx, ly, lz).vsub(dice.position);
            // Apply anti-quaternion to vector to tranform it into the local body coordinate system
            let antiRot = dice.quaternion.inverse();
            pivot = antiRot.vmult(v1); // pivot is not in local body coordinates
            anchorPos = { x: lx, y: ly, z: lz };
        }

        const joint = this._createJointBody();
        joint.position.set(anchorPos.x, anchorPos.y, anchorPos.z);

        const constraint = new PointToPointConstraint(dice, pivot, joint, new Vec3(0, 0, 0));
        this.world.addConstraint(constraint);

        this.diceConstraints.set(id, { joint, constraint, prevAllowSleep });
    }

    updateConstraint(payload){
        if (this.diceConstraints.size === 0) return;

        const positions = payload?.positions;
        if (!positions) return;

        for (const [id, pos] of Object.entries(positions)) {
            //Object.entries gives string keys, Map uses numbers
            const entry = this.diceConstraints.get(Number(id)) ?? this.diceConstraints.get(id);
            if (!entry) continue;
            entry.joint.position.set(pos.x * METERS_TO_LEGACY, pos.y * METERS_TO_LEGACY, pos.z * METERS_TO_LEGACY);
            entry.constraint.update();
            //wake to keep solver active even with allowSleep=false
            const dice = this.diceList.get(Number(id)) ?? this.diceList.get(id);
            if (dice) dice.wakeUp();
        }
    }

    //remove constraints for given ids (or all), restore sleep policy
    removeConstraint(payload){
        const ids = payload?.ids ?? Array.from(this.diceConstraints.keys());
        for (const id of ids) {
            const entry = this.diceConstraints.get(id);
            if (!entry) continue;
            this.world.removeConstraint(entry.constraint);
            this.world.removeBody(entry.joint);
            const dice = this.diceList.get(id);
            if (dice) dice.allowSleep = entry.prevAllowSleep ?? true;
            this.diceConstraints.delete(id);
        }
    }

    createShape({type, radius}){
        const legacyRadius = radius * METERS_TO_LEGACY;
        const data = DICE_SHAPE[type];
        switch(data.type){
            case "ConvexPolyhedron":
                this.shapeList.set(type, this.loadGeom(data.vertices, data.faces, legacyRadius, data.skipLastFaceIndex));
                break;
            case "Cylinder":
                this.shapeList.set(type, new Cylinder(legacyRadius*data.radiusTop, legacyRadius*data.radiusBottom, legacyRadius*data.height, data.numSegments));
                break;
            default:
                throw new Error("Unknown shape type: " + data.type);
        }
    }

    loadShape(vertices, faces, radius, skipLastFaceIndex = false) {
        const cv = new Array(vertices.length);
        const cf = new Array(faces.length);

        for (let i = 0; i < vertices.length; ++i) {
            const v = vertices[i];
            cv[i] = new Vec3(v.x * radius, v.y * radius, v.z * radius);
        }

        for (let i = 0; i < faces.length; ++i) {
            cf[i] = skipLastFaceIndex ? faces[i].slice(0, faces[i].length - 1) : faces[i];
        }
        return new ConvexPolyhedron({ vertices: cv, faces: cf });
    }

    loadGeom(vertices, faces, radius, skipLastFaceIndex = false) {
        const vectors = new Array(vertices.length);

        for (let i = 0; i < vertices.length; ++i) {
            vectors[i] = (new Vector3).fromArray(vertices[i]).normalize();
        }

        return this.loadShape(vectors, faces, radius, skipLastFaceIndex);
    }

    getDiceValue(id){
        const dice = this.diceList.get(id);

        if(!dice)
            return null;
        if(dice.result)
            return dice.result;

        //d4 reads from bottom face, everything else from top
        const vector = new Vector3(0, dice.diceShape == 'd4' ? -1 : 1, 0);
        const faceCannon = new Vector3();
        let closest_face, closest_angle = Math.PI * 2;
        for (let i = 0, l = dice.shapes[0].faceNormals.length; i < l; ++i) {
            if(DICE_SHAPE[dice.diceShape].faceValues[i] == 0)
                continue;
            faceCannon.copy(dice.shapes[0].faceNormals[i]);

            const angle = faceCannon.applyQuaternion(dice.quaternion).angleTo(vector);
            if (angle < closest_angle) {
                closest_angle = angle;
                closest_face = i;
            }
        }
        const dieValue = DICE_SHAPE[dice.diceShape].faceValues[closest_face];
        dice.result = dieValue;
        this.diceList.set(id, dice);

        return dieValue;
    }

    reset(){
        this.lastSoundType = '';
        this.lastSoundStep = 0;
        this.lastSound = 0;
        this.detectedCollides = new Array(1000);
        this.iterationsNeeded = 0;
        this.animstate = 'simulate';
        this.iteration = 0;
    }

    simulateThrow({minIterations, nbIterationsBetweenRolls, framerate, canBeFlipped, impulses}) {
        const simulationStartTime = DEBUG_SIMULATION_PERF ? performance.now() : 0;
        this.reset();

        this.minIterations = minIterations;
        this.nbIterationsBetweenRolls = nbIterationsBetweenRolls;
        this.framerate = framerate;
        this.canBeFlipped = canBeFlipped;

        //apply impulses atomically before the first world step
        const impulseIds = new Set();
        if (impulses) {
            for (const [impId, imp] of Object.entries(impulses)) {
                const numId = Number(impId);
                const dice = this.diceList.get(numId) ?? this.diceList.get(impId);
                if (!dice || !imp) continue;
                impulseIds.add(numId);
                dice.result = null;
                dice.wakeUp();
                dice.type = Body.DYNAMIC;
                dice.velocity.set(imp.velocity.x * METERS_TO_LEGACY, imp.velocity.y * METERS_TO_LEGACY, imp.velocity.z * METERS_TO_LEGACY);
                dice.angularVelocity.set(imp.angularVelocity.x, imp.angularVelocity.y, imp.angularVelocity.z);
            }
        }

        //primary dice determine when the sim ends:
        //impulse recipients + non-persistent dice (ephemeral, including dead from prior throws)
        const primaryDiceRefs = [];
        for (const [id, dice] of this.diceList) {
            if (impulseIds.has(id)) { primaryDiceRefs.push(dice); continue; }
            if (!dice.persistent) primaryDiceRefs.push(dice);
        }

        const MAX_FRAMES = 1001;
        const maxIterations = 1000;

        //dynamic buffer tracking: allocate per-die buffers on demand, backfill rest frames
        const tracked = new Map();

        //snapshot sleeping dice positions for backfill (taken after impulses so recipients are awake)
        const restingSnapshots = new Map();
        for (const [id, dice] of this.diceList) {
            if (dice.sleepState >= 2) {
                restingSnapshots.set(id, {
                    px: dice.position.x, py: dice.position.y, pz: dice.position.z,
                    qx: dice.quaternion.x, qy: dice.quaternion.y, qz: dice.quaternion.z, qw: dice.quaternion.w
                });
            }
        }

        const startTracking = (trackId, dice, frame) => {
            const posBuffer = new Float32Array(MAX_FRAMES * 3);
            const quatBuffer = new Float32Array(MAX_FRAMES * 4);
            const snap = restingSnapshots.get(trackId);
            const rawPos = snap ? [snap.px, snap.py, snap.pz] : [dice.position.x, dice.position.y, dice.position.z];
            const bfPos = [rawPos[0] * LEGACY_TO_METERS, rawPos[1] * LEGACY_TO_METERS, rawPos[2] * LEGACY_TO_METERS];
            const bfQuat = snap ? [snap.qx, snap.qy, snap.qz, snap.qw] : [dice.quaternion.x, dice.quaternion.y, dice.quaternion.z, dice.quaternion.w];
            for (let f = 0; f <= frame; f++) {
                posBuffer.set(bfPos, f * 3);
                quatBuffer.set(bfQuat, f * 4);
            }
            tracked.set(trackId, { dice, posBuffer, quatBuffer });
        };

        //seed: track awake dynamic dice already in the world (skip stagger-pending and sleeping bystanders)
        for (const [id, dice] of this.diceList) {
            if (dice.startAtIteration > 0) continue;
            if (dice.mass === 0) continue;
            if (dice.sleepState >= 2) continue;
            startTracking(id, dice, 0);
        }

        //simulation loop (inline, replaces runPhysicsSimulation)
        while (this.iteration < maxIterations) {
            ++this.iteration;

            //stagger: add bodies at their designated iteration
            if (!(this.iteration % nbIterationsBetweenRolls)) {
                for (const [id, dice] of this.diceList) {
                    if (dice.startAtIteration === this.iteration) {
                        this.world.addBody(dice);
                        if (!tracked.has(id)) startTracking(id, dice, this.iteration);
                    }
                }
            }

            this.world.step(framerate);

            //record positions/quaternions for all tracked dice
            for (const entry of tracked.values()) {
                const d = entry.dice;
                entry.posBuffer.set([d.position.x * LEGACY_TO_METERS, d.position.y * LEGACY_TO_METERS, d.position.z * LEGACY_TO_METERS], this.iteration * 3);
                entry.quatBuffer.set([d.quaternion.x, d.quaternion.y, d.quaternion.z, d.quaternion.w], this.iteration * 4);
            }

            //pick up any die that woke this frame (collision knocked a bystander)
            for (const [id, dice] of this.diceList) {
                if (tracked.has(id)) continue;
                if (dice.mass === 0) continue;
                if (dice.sleepState >= 2) continue;
                startTracking(id, dice, this.iteration);
            }

            //exit when all primary dice have settled
            if (this.iteration >= (minIterations || 0)) {
                let allSettled = true;
                for (const ref of primaryDiceRefs) {
                    if (ref.sleepState < 2) { allSettled = false; break; }
                }
                if (allSettled) break;
            }
        }

        this.iterationsNeeded = this.iteration;

        //post-sim: cache face values for all tracked dice, make ephemerals static
        const faceValues = {};
        const finalQuaternions = {};
        for (const [id, dice] of this.diceList) {
            if (tracked.has(id)) {
                dice.result = null;
                const val = this.getDiceValue(id);
                faceValues[id] = val;
                finalQuaternions[id] = { x: dice.quaternion.x, y: dice.quaternion.y, z: dice.quaternion.z, w: dice.quaternion.w };
            }
            if (!dice.persistent && !canBeFlipped) {
                if (!dice.result) dice.result = this.getDiceValue(id);
                dice.mass = 0;
                dice.dead = this.iterationsNeeded;
                dice.updateMassProperties();
            }
        }

        this.animstate = 'throw';

        if (DEBUG_SIMULATION_PERF) {
            const simulationDurationMs = performance.now() - simulationStartTime;
            console.info('[Dice So Nice] Physics simulation completed', {
                durationMs: simulationDurationMs,
                iterations: this.iterationsNeeded,
                diceCount: this.diceList.size
            });
        }

        //build transferable response from tracked buffers
        const ids = [];
        const quaternionsBuffers = [];
        const positionsBuffers = [];
        const deads = [];

        for (const [trackId, entry] of tracked) {
            ids.push(trackId);
            quaternionsBuffers.push(entry.quatBuffer.buffer);
            positionsBuffers.push(entry.posBuffer.buffer);
            deads.push(entry.dice.dead ?? false);
        }

        return new RegisterPromise.TransferableResponse({
            ids: ids,
            quaternionsBuffers: quaternionsBuffers,
            positionsBuffers: positionsBuffers,
            detectedCollides: this.detectedCollides,
            deads: deads,
            iterationsNeeded: this.iterationsNeeded,
            faceValues: faceValues,
            finalQuaternions: finalQuaternions
        }, [...quaternionsBuffers, ...positionsBuffers]);
    }

    runPhysicsSimulation() {
        while (!this.throwFinished()) {
            //Before each step, we copy the quaternions of every die in an array
            ++this.iteration;

            if (!(this.iteration % this.nbIterationsBetweenRolls)) {
                for(const [id, dice] of this.diceList){
                    if(dice.startAtIteration == this.iteration){
                        this.world.addBody(dice);
                    }
                }
            }
            this.world.step(this.framerate);


            for (let i = 0; i < this.world.bodies.length; i++) {
                if (this.world.bodies[i].stepPositions) {
                    this.world.bodies[i].stepQuaternions.set([this.world.bodies[i].quaternion.x, this.world.bodies[i].quaternion.y, this.world.bodies[i].quaternion.z,this.world.bodies[i].quaternion.w], this.iteration*4);
    
                    this.world.bodies[i].stepPositions.set([this.world.bodies[i].position.x * LEGACY_TO_METERS, this.world.bodies[i].position.y * LEGACY_TO_METERS, this.world.bodies[i].position.z * LEGACY_TO_METERS], this.iteration*3);
                }
            }
        }
    }

    throwFinished() {
        let stopped = true;
        if (this.iteration <= this.minIterations) return false;

        for(const [id, dice] of this.diceList){
            if (dice.persistent) continue;
            if (dice.sleepState < 2) {
                stopped = false;
                break;
            } else {
                dice.asleepAtIteration = this.iteration;
            }
        }

        if (this.iteration >= 1000)
            stopped = true;
        //Throw is actually finished
        if (stopped) {
            this.iterationsNeeded = this.iteration;
            for(const [id, dice] of this.diceList){
                if (dice.persistent) continue;
                dice.result = this.getDiceValue(id);
                if(!this.canBeFlipped){
                    //make the current dice on the board STATIC object so they can't be knocked
                    dice.mass = 0;
                    dice.dead = dice.asleepAtIteration || false;
                    dice.updateMassProperties();
                }
                this.diceList.set(id, dice);
            }
        }
        return stopped;
    }

    playStep({time_diff}) {
        if(this.animstate == 'simulate')
            return;
        const ids = [];
        const quaternions = new Float32Array(this.diceList.size * 4);
        const positions = new Float32Array(this.diceList.size * 3);
        //if any constraint is active, world can't be asleep (held dice must keep stepping)
        let worldAsleep = this.diceConstraints.size === 0;
        if (worldAsleep) {
            for (let i = 0; i < this.world.bodies.length; i++) {
                if (this.world.bodies[i].sleepState < 2) {
                    worldAsleep = false;
                    break;
                }
            }
        }
        if (!worldAsleep) {
            this.world.step(this.framerate, time_diff);
            for(const [id, dice] of this.diceList){
                if(!dice.dead){
                    ids.push(id);
                    quaternions.set([dice.quaternion.x, dice.quaternion.y, dice.quaternion.z,dice.quaternion.w], ids.length*4-4);

                    positions.set([dice.position.x * LEGACY_TO_METERS, dice.position.y * LEGACY_TO_METERS, dice.position.z * LEGACY_TO_METERS], ids.length*3-3);
                }
            }
        }
        return new RegisterPromise.TransferableResponse({ids: ids, quaternionsBuffers: quaternions.buffer, positionsBuffers: positions.buffer, worldAsleep: worldAsleep}, [quaternions.buffer, positions.buffer]);
    }

    //debug function to get the state of the CANNON world
    getWorldInfo() {
        console.log(`World iteration: ${this.world.stepnumber}`);

        console.log(`World has ${this.world.bodies.length} bodies:`);
        for (let i = 0; i < this.world.bodies.length; i++) {
            console.log(`body ${i}:`);
            console.log(this.world.bodies[i]);
        }

        console.log(`World has ${this.world.constraints.length} constraints:`);
        for (let i = 0; i < this.world.constraints.length; i++) {
            console.log(`constraint ${i}:`);
            console.log(this.world.constraints[i]);
        }
    }
}

new PhysicsWorker();
