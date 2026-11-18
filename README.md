# Applebrook

A quiet pixel farming village built with **Phaser 4**, React, TypeScript, and the existing vinext / Cloudflare starter. The player chooses how the village grows; residents do the daily work.

## Run locally

Use Node.js 26 (the version used for development) and npm.

```sh
npm install
npm run dev
```

Open the Local URL printed by Vite, normally `http://localhost:5173`.

```sh
npm test             # Headless simulation, persistence, pathfinding, and asset checks
npm run typecheck    # TypeScript
npm run build        # Production build using the existing Cloudflare integration
npm run assets       # Regenerate original pixel sprites and four terrain backgrounds
```

## Play

- Start with 12 named residents, wheat fields, an apple orchard, four houses, a barn, a tractor, and a village market.
- Open **Bangun**, or click a plot sign, to commission a building at its marked location. The carpenter and tractor driver construct it automatically.
- Build a mill to turn wheat into flour, then a bakery to make bread. Haulers physically pick up and deliver batches between stations; merchants sell only delivered goods.
- Follow the opening goal through the first batch of bread. Use **Dahulukan kiriman** on a production building or in **Prioritas** to move one wheat or flour delivery to the front of the queue.
- Cottages add four residents each, up to 24. An orchard expansion increases the autumn apple harvest.
- Select a resident to see their work, carried goods, and route, or follow them with the camera.
- Change **Prioritas** to balance reserves and trade. Prepare the mill, bakery, 16 residents, and 300 coins in trade revenue for the automatic autumn harvest festival.
- Drag or use arrow keys to pan, scroll or use +/− to zoom, and press H to recenter. Space pauses; B opens building; N opens residents; Escape closes the current panel.
- Time runs at 1×, 2×, or 4×. One day is six real minutes at 1×; each season lasts four days. Residents return home at night. Winter shifts outdoor workers to hauling and gathering wood.

## Saves and offline progress

Progress is stored in this browser's `localStorage`, under `applebrook.village.v1`, every eight seconds and on page hide. Saves include jobs, routes, cargo, construction, and production stocks. Invalid saves fall back to a new village. If storage is unavailable, play continues in memory and the interface reports that saving is unavailable.

Returning after at least 15 seconds advances the same simulation at 1×, capped at **24 minutes / one season**, and shows a summary. Paused villages stay paused offline. There are no household consumption penalties while away. Saves belong to the browser and are not synchronized across devices.

## Architecture

The framework was implemented before its art assets:

- `game/simulation.ts` owns the independent village simulation: job dispatch, production, trade, seasons, building, population, and the festival. It runs without Phaser or a browser.
- `game/world.ts` defines the shared map, work stations, building plots, and weighted A* routing. Routes prefer lanes, avoid buildings, and cross the stream at its bridge.
- `game/controller.ts` connects simulation commands to React snapshots and Phaser. `game/persistence.ts` validates saves and handles bounded offline progress.
- `game/VillageScene.ts` renders the scene, directional character frames, cargo, seasonal trees, snow-covered roofs, lighting, the tractor, camera controls, and selection.
- `components/applebrook/` contains the accessible HTML controls, menus, resident details, minimap, and offline summary. Phaser is imported only after the client mounts.
- `scripts/generate-assets.mjs` is the original pixel-art source. It writes a Phaser texture atlas and four native-resolution backgrounds to `public/assets/applebrook/`. The committed PNGs work without running the generator. There are no remote image dependencies.

Pixelify Sans and Atkinson Hyperlegible are self-hosted in `public/fonts/`; their licenses are included there. Optional wind and bird ambience is synthesized locally with Web Audio and starts only when enabled.

This is a playable single-player foundation. The existing deployment scripts are retained; deployment is separate from local development. Automated checks cover the simulation and asset contracts; visual browser QA should also be performed on the target desktop and mobile devices.

