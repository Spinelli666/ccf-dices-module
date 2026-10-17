// Modified by ccf-web (2026-10-12) from Dice So Nice 6.2.9 (AGPL-3.0): asset URLs made absolute (/modules/dice-so-nice/...).

import { DicePreset } from './DicePreset.js';

export const BASE_PRESETS_LIST = [];
export const EXTRA_PRESETS_LIST = [];


//////////////////////////////////////////////////
//              BASE SYSTEM                     //
//////////////////////////////////////////////////
let diceobj;

diceobj = new DicePreset('d2');
diceobj.setLabels(['1', '2']);
diceobj.setValues(1, 2);
diceobj.inertia = 8;
diceobj.mass = 400;
diceobj.scale = 0.9;
BASE_PRESETS_LIST.push(diceobj);

diceobj = new DicePreset('dc', 'd2');
diceobj.term = 'Coin';
diceobj.setAtlas('/modules/dice-so-nice/textures/standard.json');
diceobj.setLabels([
    'tail.webp',
    'heads.webp'
]);
diceobj.setBumpMaps([
    'tail_bump.webp',
    'heads_bump.webp'
]);
diceobj.setValues(0, 1);
diceobj.inertia = 8;
diceobj.scale = 0.9;
diceobj.colorset = "coin_default"
BASE_PRESETS_LIST.push(diceobj);

diceobj = new DicePreset('d4');
diceobj.setLabels(['1', '2', '3', '4']);
diceobj.setValues(1, 4);
diceobj.inertia = 5;
diceobj.scale = 1.2;
BASE_PRESETS_LIST.push(diceobj);

diceobj = new DicePreset('d6');
diceobj.setLabels(['1', '2', '3', '4', '5', '6']);
diceobj.setValues(1, 6);
diceobj.scale = 0.9;
BASE_PRESETS_LIST.push(diceobj);

diceobj = new DicePreset('d3', 'd6');
diceobj.setLabels(['1', '2', '3']);
diceobj.setValues(1, 3);
diceobj.scale = 0.9;
BASE_PRESETS_LIST.push(diceobj);

diceobj = new DicePreset('df', 'd6');
diceobj.term = 'FateDie';
diceobj.setLabels(['−', ' ', '+']);
diceobj.setValues(-1, 1);
diceobj.scale = 0.9;
BASE_PRESETS_LIST.push(diceobj);

diceobj = new DicePreset('d8');
diceobj.setLabels(['1', '2', '3', '4', '5', '6', '7', '8']);
diceobj.setValues(1, 8);
BASE_PRESETS_LIST.push(diceobj);

diceobj = new DicePreset('d10');
diceobj.setLabels(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);
diceobj.setValues(1, 10);
diceobj.mass = 450;
diceobj.inertia = 9;
diceobj.scale = 0.9;
BASE_PRESETS_LIST.push(diceobj);

diceobj = new DicePreset('d5', 'd10');
diceobj.setLabels(['1', '2', '3', '4', '5']);
diceobj.setValues(1, 5);
diceobj.mass = 450;
diceobj.inertia = 9;
diceobj.scale = 0.9;
BASE_PRESETS_LIST.push(diceobj);

diceobj = new DicePreset('d100', 'd10');
diceobj.setLabels(['10', '20', '30', '40', '50', '60', '70', '80', '90', '00']);
diceobj.setValues(10, 100, 10);
diceobj.mass = 450;
diceobj.inertia = 9;
diceobj.scale = 0.9;
BASE_PRESETS_LIST.push(diceobj);

diceobj = new DicePreset('d1000', 'd10');
diceobj.setLabels(['100', '200', '300', '400', '500', '600', '700', '800', '900', '000']);
diceobj.setValues(100, 1000, 100);
diceobj.mass = 450;
diceobj.inertia = 9;
diceobj.scale = 0.9;
diceobj.fontScale = 0.55;
BASE_PRESETS_LIST.push(diceobj);

diceobj = new DicePreset('d10000', 'd10');
diceobj.setLabels(['1000', '2000', '3000', '4000', '5000', '6000', '7000', '8000', '9000', '0000']);
diceobj.setValues(1000, 10000, 1000);
diceobj.mass = 450;
diceobj.inertia = 9;
diceobj.scale = 0.9;
diceobj.fontScale = 0.45;
BASE_PRESETS_LIST.push(diceobj);

diceobj = new DicePreset('d12');
diceobj.setLabels(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
diceobj.setValues(1, 12);
diceobj.mass = 450;
diceobj.inertia = 8;
diceobj.scale = 0.9;
BASE_PRESETS_LIST.push(diceobj);

diceobj = new DicePreset('d14');
diceobj.setLabels(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14']);
diceobj.setValues(1, 14);
diceobj.mass = 450;
diceobj.inertia = 8;
diceobj.scale = 1;
BASE_PRESETS_LIST.push(diceobj);

diceobj = new DicePreset('d7', 'd14');
diceobj.setLabels(['1', '2', '3', '4', '5', '6', '7']);
diceobj.setValues(1, 7);
diceobj.mass = 450;
diceobj.inertia = 8;
diceobj.scale = 1;
BASE_PRESETS_LIST.push(diceobj);

diceobj = new DicePreset('d16');
diceobj.setLabels(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16']);
diceobj.setValues(1, 16);
diceobj.mass = 450;
diceobj.inertia = 8;
diceobj.scale = 1;
BASE_PRESETS_LIST.push(diceobj);

diceobj = new DicePreset('d20');
diceobj.setLabels(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20']);
diceobj.setValues(1, 20);
diceobj.mass = 500;
diceobj.scale = 1;
diceobj.inertia = 6;
BASE_PRESETS_LIST.push(diceobj);

diceobj = new DicePreset('d24');
diceobj.setLabels(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24']);
diceobj.setValues(1, 24);
diceobj.mass = 500;
diceobj.scale = 1;
diceobj.inertia = 10;
BASE_PRESETS_LIST.push(diceobj);

diceobj = new DicePreset('d30');
diceobj.setLabels(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30']);
diceobj.setValues(1, 30);
diceobj.mass = 500;
diceobj.scale = 1;
diceobj.inertia = 10;
BASE_PRESETS_LIST.push(diceobj);

//////////////////////////////////////////////////
//              EXTRA SYSTEM                    //
//////////////////////////////////////////////////

/**
 * Dot System
 */
EXTRA_PRESETS_LIST.push({
    type: "d6",
    atlas: "/modules/dice-so-nice/textures/dot.json",
    labels: [
        'd6-1.webp',
        'd6-2.webp',
        'd6-3.webp',
        'd6-4.webp',
        'd6-5.webp',
        'd6-6.webp'
    ],
    bumpMaps: [
        'd6-1-b.webp',
        'd6-2-b.webp',
        'd6-3-b.webp',
        'd6-4-b.webp',
        'd6-5-b.webp',
        'd6-6-b.webp'
    ],
    system: "dot"
});

EXTRA_PRESETS_LIST.push({
    type: "d6",
    atlas: "/modules/dice-so-nice/textures/dot.json",
    labels: [
        'd6-1-black.webp',
        'd6-2-black.webp',
        'd6-3-black.webp',
        'd6-4-black.webp',
        'd6-5-black.webp',
        'd6-6-black.webp',
    ],
    bumpMaps: [
        'd6-1-b.webp',
        'd6-2-b.webp',
        'd6-3-b.webp',
        'd6-4-b.webp',
        'd6-5-b.webp',
        'd6-6-b.webp',
    ],
    system: "dot_b"
});

/**
 * foundry_vtt System
 */
EXTRA_PRESETS_LIST.push({
    type: "d2",
    labels: ['1', 'F'],
    font: "FoundryVTT",
    system: "foundry_vtt",
    fontScale: 1.2
});
EXTRA_PRESETS_LIST.push({
    type: "d4",
    labels: ['1', '2', '3', 'E'],
    font: "FoundryVTT",
    system: "foundry_vtt",
    fontScale: 0.8
});
EXTRA_PRESETS_LIST.push({
    type: "d6",
    labels: ['1', '2', '3', '4', '5', 'E'],
    font: "FoundryVTT",
    system: "foundry_vtt"
});
EXTRA_PRESETS_LIST.push({
    type: "df",
    labels: ['−', ' ', '+'],
    font: "FoundryVTT",
    system: "foundry_vtt"
});
EXTRA_PRESETS_LIST.push({
    type: "d3",
    labels: ['1', '2', 'E'],
    font: "FoundryVTT",
    system: "foundry_vtt"
});
EXTRA_PRESETS_LIST.push({
    type: "d8",
    labels: ['1', '2', '3', '4', '5', '6', '7', 'F'],
    font: "FoundryVTT",
    system: "foundry_vtt"
});
EXTRA_PRESETS_LIST.push({
    type: "d10",
    labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'E'],
    font: "FoundryVTT",
    system: "foundry_vtt",
    fontScale: 0.9
});
EXTRA_PRESETS_LIST.push({
    type: "d5",
    labels: ['1', '2', '3', '4', 'E'],
    font: "FoundryVTT",
    system: "foundry_vtt",
    fontScale: 0.9
});
EXTRA_PRESETS_LIST.push({
    type: "d100",
    labels: ['10', '20', '30', '40', '50', '60', '70', '80', '90', 'E'],
    font: "FoundryVTT",
    system: "foundry_vtt"
});
EXTRA_PRESETS_LIST.push({
    type: "d12",
    labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', 'E'],
    font: "FoundryVTT",
    system: "foundry_vtt"
});
EXTRA_PRESETS_LIST.push({
    type: "d14",
    labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', 'E'],
    font: "FoundryVTT",
    system: "foundry_vtt"
});
EXTRA_PRESETS_LIST.push({
    type: "d7",
    labels: ['1', '2', '3', '4', '5', '6', 'E'],
    font: "FoundryVTT",
    system: "foundry_vtt"
});
EXTRA_PRESETS_LIST.push({
    type: "d16",
    labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', 'E'],
    font: "FoundryVTT",
    system: "foundry_vtt"
});
EXTRA_PRESETS_LIST.push({
    type: "d20",
    labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', 'F'],
    font: "FoundryVTT",
    system: "foundry_vtt"
});
EXTRA_PRESETS_LIST.push({
    type: "d24",
    labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', 'F'],
    font: "FoundryVTT",
    system: "foundry_vtt"
});
EXTRA_PRESETS_LIST.push({
    type: "d30",
    labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', 'E'],
    font: "FoundryVTT",
    system: "foundry_vtt"
});


/**
 * Spectrum System
 */

EXTRA_PRESETS_LIST.push({
    type: "df",
    atlas: "/modules/dice-so-nice/textures/spectrum-0.json",
    labels: [
        'df-m.webp',
        'df-0.webp',
        'df-p.webp'
    ],
    emissiveMaps: [
        'df-m.webp',
        'df-0.webp',
        'df-p.webp'
    ],
    emissive: 0xffffff,
    emissiveIntensity: 2,
    colorset: "spectrum_default",
    system: "spectrum"
});

EXTRA_PRESETS_LIST.push({
    type: "d2",
    atlas: "/modules/dice-so-nice/textures/spectrum-0.json",
    labels: [
        'd2-1.webp',
        'd2-2.webp'
    ],
    emissiveMaps: [
        'd2-1.webp',
        'd2-2.webp'
    ],
    emissiveIntensity: 2,
    emissive: 0xffffff,
    colorset: "spectrum_default",
    system: "spectrum"
});

EXTRA_PRESETS_LIST.push({
    type: "dc",
    atlas: "/modules/dice-so-nice/textures/spectrum-0.json",
    labels: [
        'dc-h.webp',
        'dc-t.webp'
    ],
    emissiveMaps: [
        'dc-h.webp',
        'dc-t.webp'
    ],
    emissiveIntensity: 2,
    emissive: 0xffffff,
    colorset: "spectrum_default",
    system: "spectrum"
});

EXTRA_PRESETS_LIST.push({
    type: "d4",
    atlas: "/modules/dice-so-nice/textures/spectrum-0.json",
    labels: [
        'd4-1.webp',
        'd4-2.webp',
        'd4-3.webp',
        'd4-4.webp'
    ],
    emissiveMaps: [
        'd4-1.webp',
        'd4-2.webp',
        'd4-3.webp',
        'd4-4.webp'
    ],
    emissive: 0xffffff,
    colorset: "spectrum_default",
    system: "spectrum"
});

EXTRA_PRESETS_LIST.push({
    type: "d6",
    atlas: "/modules/dice-so-nice/textures/spectrum-0.json",
    labels: [
        'd6-1.webp',
        'd6-2.webp',
        'd6-3.webp',
        'd6-4.webp',
        'd6-5.webp',
        'd6-6.webp'
    ],
    emissiveMaps: [
        'd6-1.webp',
        'd6-2.webp',
        'd6-3.webp',
        'd6-4.webp',
        'd6-5.webp',
        'd6-6.webp'
    ],
    emissive: 0xffffff,
    colorset: "spectrum_default",
    system: "spectrum"
});

EXTRA_PRESETS_LIST.push({
    type: "d8",
    atlas: "/modules/dice-so-nice/textures/spectrum-0.json",
    labels: [
        'd8-1.webp',
        'd8-2.webp',
        'd8-3.webp',
        'd8-4.webp',
        'd8-5.webp',
        'd8-6.webp',
        'd8-7.webp',
        'd8-8.webp'
    ],
    emissiveMaps: [
        'd8-1.webp',
        'd8-2.webp',
        'd8-3.webp',
        'd8-4.webp',
        'd8-5.webp',
        'd8-6.webp',
        'd8-7.webp',
        'd8-8.webp'
    ],
    emissiveIntensity: 2,
    emissive: 0xffffff,
    colorset: "spectrum_default",
    system: "spectrum"
});

EXTRA_PRESETS_LIST.push({
    type: "d10",
    atlas: "/modules/dice-so-nice/textures/spectrum-0.json",
    labels: [
        'd10-1.webp',
        'd10-2.webp',
        'd10-3.webp',
        'd10-4.webp',
        'd10-5.webp',
        'd10-6.webp',
        'd10-7.webp',
        'd10-8.webp',
        'd10-9.webp',
        'd10-0.webp'
    ],
    emissiveMaps: [
        'd10-1.webp',
        'd10-2.webp',
        'd10-3.webp',
        'd10-4.webp',
        'd10-5.webp',
        'd10-6.webp',
        'd10-7.webp',
        'd10-8.webp',
        'd10-9.webp',
        'd10-0.webp'
    ],
    emissiveIntensity: 2,
    emissive: 0xffffff,
    colorset: "spectrum_default",
    system: "spectrum"
});

EXTRA_PRESETS_LIST.push({
    type: "d12",
    atlas: "/modules/dice-so-nice/textures/spectrum-0.json",
    labels: [
        'd12-1.webp',
        'd12-2.webp',
        'd12-3.webp',
        'd12-4.webp',
        'd12-5.webp',
        'd12-6.webp',
        'd12-7.webp',
        'd12-8.webp',
        'd12-9.webp',
        'd12-10.webp',
        'd12-11.webp',
        'd12-12.webp'
    ],
    emissiveMaps: [
        'd12-1.webp',
        'd12-2.webp',
        'd12-3.webp',
        'd12-4.webp',
        'd12-5.webp',
        'd12-6.webp',
        'd12-7.webp',
        'd12-8.webp',
        'd12-9.webp',
        'd12-10.webp',
        'd12-11.webp',
        'd12-12.webp'
    ],
    emissiveIntensity: 2,
    emissive: 0xffffff,
    colorset: "spectrum_default",
    system: "spectrum"
});

EXTRA_PRESETS_LIST.push({
    type: "d100",
    atlas: "/modules/dice-so-nice/textures/spectrum-0.json",
    labels: [
        'd100-10.webp',
        'd100-20.webp',
        'd100-30.webp',
        'd100-40.webp',
        'd100-50.webp',
        'd100-60.webp',
        'd100-70.webp',
        'd100-80.webp',
        'd100-90.webp',
        'd100-00.webp'
    ],
    emissiveMaps: [
        'd100-10.webp',
        'd100-20.webp',
        'd100-30.webp',
        'd100-40.webp',
        'd100-50.webp',
        'd100-60.webp',
        'd100-70.webp',
        'd100-80.webp',
        'd100-90.webp',
        'd100-00.webp'
    ],
    emissiveIntensity: 2,
    emissive: 0xffffff,
    colorset: "spectrum_default",
    system: "spectrum"
});

EXTRA_PRESETS_LIST.push({
    type: "d20",
    atlas: "/modules/dice-so-nice/textures/spectrum-0.json",
    labels: [
        'd20-1.webp',
        'd20-2.webp',
        'd20-3.webp',
        'd20-4.webp',
        'd20-5.webp',
        'd20-6.webp',
        'd20-7.webp',
        'd20-8.webp',
        'd20-9.webp',
        'd20-10.webp',
        'd20-11.webp',
        'd20-12.webp',
        'd20-13.webp',
        'd20-14.webp',
        'd20-15.webp',
        'd20-16.webp',
        'd20-17.webp',
        'd20-18.webp',
        'd20-19.webp',
        'd20-20.webp'
    ],
    emissiveMaps: [
        'd20-1.webp',
        'd20-2.webp',
        'd20-3.webp',
        'd20-4.webp',
        'd20-5.webp',
        'd20-6.webp',
        'd20-7.webp',
        'd20-8.webp',
        'd20-9.webp',
        'd20-10.webp',
        'd20-11.webp',
        'd20-12.webp',
        'd20-13.webp',
        'd20-14.webp',
        'd20-15.webp',
        'd20-16.webp',
        'd20-17.webp',
        'd20-18.webp',
        'd20-19.webp',
        'd20-20.webp'
    ],
    emissiveIntensity: 2,
    emissive: 0xffffff,
    colorset: "spectrum_default",
    system: "spectrum"
});
