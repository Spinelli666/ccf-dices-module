# ccf-dices-module — Dice So Nice! for ccf-web

The 3D dice of [Dice So Nice!](https://gitlab.com/riccisi/foundryvtt-dice-so-nice) 6.2.9 (by JDW and
Simone) as a module for **ccf-web**, the Cardigan RPG's sheets and virtual tabletop
([cardiganficha.online](https://cardiganficha.online)). A table's GM turns it on in ⚙️ →
"Gerenciar Módulos", and it replaces the site's own dice engine on that table.

## License

**GNU AGPL v3** (`LICENSE.md`), like Dice So Nice itself. Everything in this repository is covered:
the Dice So Nice files and the glue written for ccf-web. Whoever uses the site with this module turned
on can get this source here (the site links to it in "Sobre e Créditos").

## What's here

- `src/`: Dice So Nice's engine files, copied unchanged from the module, except the ones whose first
  line says "Modified by ccf-web" (asset URLs made absolute; physics worker loaded with
  `new Worker(new URL(...))` from the built `PhysicsWorker.js`).
- `src/ccf/`: the glue: `foundry-shim.js` (the Foundry VTT globals the engine needs, with Foundry's
  and Dice So Nice's defaults), `Dice3DLite.js` (a reduced `Dice3D`: box setup, queue and hide timing
  from the module), `index.js` (creates the engine once) and `module.js`, the entry for ccf-web's
  module API v1: `activate(ccf)` registers Dice So Nice as the table's dice renderer.
- `assets/`: the module's models, textures, sounds and fonts, unchanged.
- `module.json`: the manifest ccf-web reads.

## Building

```bash
npm ci
npm run build                     # into dist/
node scripts/build.mjs <folder>   # into another folder
```

ccf-web builds it into its `public/modules/dice-so-nice/` with `scripts/install-modules.sh`. The output
holds the bundle (`index.js`, the engine in `chunks/`, loaded on the first throw), the assets,
`module.json` and `LICENSE.md`.

Dependencies pinned to Dice So Nice 6.2.9's lockfile: three 0.184.0, cannon-es (JiDW fork, commit
0b473dd), webworker-promise 0.5.1, stats-gl 3.8.0.

## Module API v1

`activate(ccf)` gets `ccf.user`, `ccf.baseUrl` and `ccf.dice.registerRenderer({ sides, preload,
setAppearance, show, hideNow })`. The full description is in ccf-web's `docs/MODULES.md`.
