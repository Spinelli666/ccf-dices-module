import { Vector3 } from 'three';

// scene convention: 1 unit = 1 meter, +Y up, desk in XZ at y=0, d6 edge ~16mm

export const WORLD_UP = Object.freeze(new Vector3(0, 1, 0));
export const TARGET_D6_EDGE_METERS = 0.016;
export const GRAVITY_Y = -9.81;

//how high the die lifts when grabbed
export const GRAB_LIFT_EPHEMERAL = 0.05;
export const GRAB_LIFT_PERSISTENT = 0.15;

//legacy-to-meters factor for third-party GLTF dice (legacy baseScale was 50)
export const LEGACY_TO_METERS = TARGET_D6_EDGE_METERS / 50;
