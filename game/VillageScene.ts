import Phaser from "phaser";
import type { VillageController } from "./controller.ts";
import type { Season, Villager } from "./types.ts";
import { calendar } from "./simulation.ts";
import { BUILD_SITES, HOME_TILES, STATIONS, WORLD_HEIGHT, WORLD_WIDTH, pointAt } from "./world.ts";

interface Actor {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  cargo: Phaser.GameObjects.Image;
}
export class VillageScene extends Phaser.Scene {
  private controller: VillageController;
  private terrain!: Phaser.GameObjects.Image;
  private actors = new Map<number, Actor>();
  private trees: { image: Phaser.GameObjects.Image; apple: boolean; variant: number }[] = [];
  private crops: Phaser.GameObjects.Image[] = [];
  private structures = new Map<string, Phaser.GameObjects.Image>();
  private hedges: Phaser.GameObjects.Image[] = [];
  private hoverLabel!: Phaser.GameObjects.Text;
  private fieldBales: Phaser.GameObjects.Image[] = [];
  private placeMarkers = new Map<string, Phaser.GameObjects.Container>();
  private windowLights: Phaser.GameObjects.Rectangle[] = [];
  private millSails: Phaser.GameObjects.Image | null = null;
  private festivalDecor: Phaser.GameObjects.Image[] = [];
  private selection!: Phaser.GameObjects.Graphics;
  private lighting!: Phaser.GameObjects.Rectangle;
  private atmosphere!: Phaser.GameObjects.Graphics;
  private season: Season = "spring";
  private cropStage = -2;
  private dragStart: { x: number; y: number; scrollX: number; scrollY: number } | null = null;
  private wasDragged = false;
  private lastEarned = 0;
  private lastHarvest = 0;
  private lastApples = 0;
  private removeCamera?: () => void;
  private reducedMotion = false;
  private cursors?: Pick<Phaser.Types.Input.Keyboard.CursorKeys, "left" | "right" | "up" | "down">;
  private readyCallback: () => void;
  private errorCallback: () => void;
  constructor(controller: VillageController, ready: () => void, error: () => void) {
    super({ key: "Village" }); this.controller = controller; this.readyCallback = ready; this.errorCallback = error;
  }
  preload() {
    this.load.atlas("village", "/assets/applebrook/village.png", "/assets/applebrook/village.json");
    for (const season of ["spring", "summer", "autumn", "winter"]) this.load.image(`terrain-${season}`, `/assets/applebrook/terrain-${season}.png`);
    this.load.once("loaderror", this.errorCallback);
  }
  create() {
    if (!this.textures.exists("village")) { this.errorCallback(); return; }
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.season = calendar(this.controller.state).season;
    this.lastEarned = this.controller.state.stats.earned;
    this.lastHarvest = this.controller.state.stats.harvestedWheat;
    this.lastApples = this.controller.state.stats.harvestedApples;
    this.terrain = this.add.image(0, 0, `terrain-${this.season}`).setOrigin(0).setScale(2).setDepth(-1000);
    this.decorate(); this.createVillage(); this.createControls();
    this.selection = this.add.graphics().setDepth(2500);
    this.atmosphere = this.add.graphics().setDepth(2600);
    this.lighting = this.add.rectangle(0, 0, 4000, 2400, 0x243a62, 0).setOrigin(0).setScrollFactor(0).setDepth(3000);
    this.hoverLabel = this.add.text(0, 0, "", {
      fontFamily: "Pixelify, sans-serif", fontSize: "18px", color: "#fff3cc",
      backgroundColor: "#202c27", padding: { x: 8, y: 4 },
    }).setOrigin(0.5, 1).setDepth(3100).setVisible(false);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT).setRoundPixels(true);
    this.homeCamera();
    this.removeCamera = this.controller.onCamera(command => {
      if (command.type === "zoom") this.zoomBy(command.delta);
      else if (command.type === "home") { this.controller.followNpc(false); this.homeCamera(); }
      else { this.controller.followNpc(false); this.cameras.main.centerOn(command.x, command.y); }
    });
    this.scale.on("resize", this.homeCamera, this);
    this.events.once("shutdown", () => { this.removeCamera?.(); this.scale.off("resize", this.homeCamera, this); });
    this.readyCallback();
  }
  private image(frame: string, x: number, y: number, scale = 2) {
    return this.add.image(x, y, "village", frame).setOrigin(0.5, 1).setScale(scale).setDepth(y);
  }
  private tree(x: number, y: number, apple = false, variant = 0) {
    const image = this.image(`${apple ? "apple" : "tree"}-${this.season}-${variant}`, x, y);
    this.trees.push({ image, apple, variant }); return image;
  }
  private decorate() {
    let seed = 451;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    // A deliberately planted woodland border frames the playable village.
    for (let i = 0; i < 170; i++) {
      const side = i % 4;
      let x = 0, y = 0;
      if (side === 0) { x = random() * 165; y = random() * WORLD_HEIGHT; }
      else if (side === 1) { x = 140 + random() * 1450; y = 30 + random() * 95; }
      else if (side === 2) { x = 1600 + random() * 140; y = random() * WORLD_HEIGHT; }
      else { x = 80 + random() * 1550; y = 1140 + random() * 100; }
      if (Math.abs(x - 1160) > 75) this.tree(x, y, false, Math.floor(random() * 3)).setScale(1.5 + random() * 0.9);
    }
    for (const [x, y, v] of [[250, 200, 1], [310, 240, 0], [530, 190, 2], [590, 270, 1], [980, 210, 0], [1025, 345, 2], [1030, 470, 1], [185, 510, 2], [195, 600, 0], [650, 485, 1], [670, 910, 0], [1030, 1010, 1], [1400, 1030, 0], [1500, 700, 2], [1480, 620, 1]]) this.tree(x, y, false, v);
    for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) this.tree(1310 + col * 72, 290 + row * 90, true, col % 3);
    for (let row = 0; row < 7; row++) for (let col = 0; col < 11; col++) {
      const x = col < 5 ? 267 + col * 31 : 444 + (col - 5) * 27;
      this.crops.push(this.image("wheat-3", x, 662 + row * 28 + Math.round(random() * 4)));
    }
    for (const [x, y, count] of [[590, 441, 3], [924, 381, 3], [682, 421, 2], [221, 932, 4], [1295, 720, 3], [1430, 1050, 5], [442, 994, 3], [1545, 538, 2]]) {
      for (let i = 0; i < count; i++) {
        this.hedges.push(this.image("hedge-" + this.season, x + i * 32, y + (i % 2) * 7, 1.6));
      }
    }
    for (let i = 0; i < 4; i++) this.fieldBales.push(this.image("hay", 608 + (i % 2) * 21, 781 + Math.floor(i / 2) * 23, 1.4));
    for (let i = 0; i < 11; i++) {
      this.image("fence", 257 + i * 32, 848);
      if (i < 7) this.image("fence", 1290 + i * 37, 512);
    }
    for (let i = 0; i < 5; i++) this.image("fence-side", 252, 678 + i * 33);
    for (const [x, y, frame] of [[490, 440, "hay"], [490, 466, "hay"], [450, 490, "barrel"], [358, 470, "crate"], [612, 823, "hay"], [637, 823, "hay"], [610, 748, "scarecrow"], [1248, 488, "crate"], [1275, 488, "basket"], [910, 731, "crate"], [974, 689, "barrel"], [988, 723, "basket"], [769, 371, "flowers"], [875, 301, "flowers"], [967, 195, "flowers"], [646, 333, "mailbox"], [868, 289, "mailbox"], [753, 725, "bench"], [1017, 609, "sign"], [680, 542, "sign"]] as const) this.image(frame, x, y);
    // Small details share the same world coordinates as the simulation.
    for (let i = 0; i < 55; i++) {
      const x = 180 + random() * 1390, y = 150 + random() * 950;
      if (x > 280 && x < 1030 && y > 230 && y < 1000 || x > 1090 && x < 1240) continue;
      this.image(i % 3 === 0 ? "rock" : "flowers", x, y, 1.5);
    }
    this.image("bridge", 1163, 611, 2);
    this.image("well", 833, 746);
    this.image("lamp", 763, 534); this.image("lamp", 1010, 734);
    this.building("market-west", "market-green", 953, 674, "Pasar desa", "market");
  }

  private target(object: Phaser.GameObjects.GameObject, title: string, select: () => void) {
    object.setData("select", select);
    object.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown || !this.hoverLabel) return;
      this.hoverLabel.setText(title).setPosition(pointer.worldX + 10, pointer.worldY - 13)
        .setScale(1 / this.cameras.main.zoom).setVisible(true);
    });
    object.on("pointerout", () => this.hoverLabel?.setVisible(false));
  }

  private building(id: string, frame: string, x: number, y: number, title?: string, selectId = id) {
    const seasonalFrame = this.season === "winter" && this.textures.get("village").has(`${frame}-winter`) ? `${frame}-winter` : frame;
    const image = this.image(seasonalFrame, x, y).setData("base-frame", frame).setInteractive({ useHandCursor: true, pixelPerfect: true });
    this.target(image, title ?? "Rumah warga", () => this.controller.selectPlace(selectId));
    image.on("pointerover", () => image.setTint(0xfff4d0));
    image.on("pointerout", () => image.clearTint());
    this.structures.set(id, image);
    return image;
  }
  private createVillage() {
    this.building("barn", "barn", 400, 450, "Lumbung");
    HOME_TILES.slice(0, 4).forEach((tile, i) => {
      const p = pointAt(tile); this.building(`home-${i}`, `house-${i % 3}`, p.x, p.y - 8);
      this.windowLights.push(this.add.rectangle(p.x - 24, p.y - 47, 12, 12, 0xffda79).setDepth(p.y + 1).setAlpha(0));
    });
    this.building("market", "market", 861, 665, "Pasar desa");
    this.festivalDecor = [this.image("festival-table", 927, 739), this.image("festival-flags", 900, 605)];
    for (const decoration of this.festivalDecor) decoration.setVisible(false);
    const field = this.add.zone(428, 732, 352, 204).setDepth(-5).setInteractive({ useHandCursor: true });
    const orchard = this.add.zone(1414, 370, 314, 248).setDepth(-5).setInteractive({ useHandCursor: true });
    this.target(field, "Ladang gandum", () => this.controller.selectPlace("wheat"));
    this.target(orchard, "Kebun apel", () => this.controller.selectPlace("orchard-info"));
    for (const site of BUILD_SITES) {
      const p = pointAt({ col: site.col, row: site.row });
      const shadow = this.add.ellipse(0, 0, 45, 20, 0x768750, 0.22);
      const sign = this.add.image(0, -10, "village", "build-sign").setScale(site.id === "mill" ? 1.6 : 1.1);
      const marker = this.add.container(p.x, p.y, [shadow, sign]).setDepth(p.y).setSize(52, 65).setInteractive({ useHandCursor: true });
      this.target(marker, site.name, () => this.controller.selectPlace(site.id));
      marker.on("pointerover", () => sign.setTint(0xffefb0)); marker.on("pointerout", () => sign.clearTint());
      this.placeMarkers.set(site.id, marker);
    }
    this.syncProjects();
  }
  private syncProjects() {
    for (const project of this.controller.state.projects) {
      const existing = this.structures.get(project.id), frame = project.complete ? project.kind === "cottage" ? "house-1" : project.kind === "orchard" ? "orchard-shed" : project.kind : "construction";
      if (existing?.getData("base-frame") === frame) continue;
      existing?.destroy(); this.placeMarkers.get(project.id)?.setVisible(false);
      const p = pointAt({ col: project.col, row: project.row + 1 });
      const site = BUILD_SITES.find(b => b.id === project.id)!;
      this.building(project.id, frame, p.x, p.y - 12, site.name);
      if (project.complete) {
        if (project.kind === "mill") this.millSails = this.add.image(p.x, p.y - 144, "village", "mill-sails").setScale(2).setDepth(p.y + 2);
        if (project.kind === "orchard") for (let i = 0; i < 6; i++) this.tree(p.x - 45 + i % 3 * 70, p.y - 110 - Math.floor(i / 3) * 85, true, i % 3);
      }
    }
  }
  private createControls() {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.wasDragged = false;
      this.hoverLabel?.setVisible(false);
      this.dragStart = { x: pointer.x, y: pointer.y, scrollX: this.cameras.main.scrollX, scrollY: this.cameras.main.scrollY };
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown || !this.dragStart) return;
      const dx = pointer.x - this.dragStart.x, dy = pointer.y - this.dragStart.y;
      if (Math.hypot(dx, dy) < 6 && !this.wasDragged) return;
      if (!this.wasDragged) this.controller.followNpc(false);
      this.wasDragged = true;
      this.cameras.main.setScroll(this.dragStart.scrollX - dx / this.cameras.main.zoom, this.dragStart.scrollY - dy / this.cameras.main.zoom);
    });
    this.input.on("pointerup", (_pointer: Phaser.Input.Pointer, objects: Phaser.GameObjects.GameObject[]) => {
      if (this.dragStart && !this.wasDragged) {
        const select = objects[0]?.getData("select") as (() => void) | undefined;
        if (select) select();
        else this.controller.selectPlace(null);
      }
      this.dragStart = null;
    });
    this.input.on("wheel", (_p: unknown, _objects: unknown, _dx: number, dy: number) => this.zoomBy(dy < 0 ? 0.1 : -0.1));
    // Do not capture Space globally: focused HTML buttons must retain native activation.
    this.cursors = this.input.keyboard?.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.LEFT, right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      up: Phaser.Input.Keyboard.KeyCodes.UP, down: Phaser.Input.Keyboard.KeyCodes.DOWN,
    }, false) as typeof this.cursors;
  }
  private homeCamera() {
    const camera = this.cameras.main;
    camera.setZoom(this.scale.width < 681 ? 0.66 : Phaser.Math.Clamp(Math.min(this.scale.width / 1470, this.scale.height / 940), 0.6, 1.25));
    camera.centerOn(this.scale.width < 681 ? 490 : 864, 535);
  }
  private zoomBy(delta: number) { this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom + delta, 0.45, 1.65)); }
  update(time: number, delta: number) {
    if (!this.terrain) return;
    this.controller.tick(delta / 1000);
    const state = this.controller.state, calendarNow = calendar(state), snapshot = this.controller.getSnapshot();
    if (calendarNow.season !== this.season) {
      this.season = calendarNow.season; this.terrain.setTexture(`terrain-${this.season}`);
      for (const tree of this.trees) tree.image.setFrame(`${tree.apple ? "apple" : "tree"}-${this.season}-${tree.variant}`);
      for (const hedge of this.hedges) hedge.setFrame("hedge-" + this.season);
      for (const building of this.structures.values()) {
        const base = building.getData("base-frame") as string;
        building.setFrame(this.season === "winter" && this.textures.get("village").has(`${base}-winter`) ? `${base}-winter` : base);
      }
    }
    const stage = calendarNow.season === "winter" ? -1 : Math.min(3, Math.floor(state.wheatGrowth * 4));
    if (stage !== this.cropStage) {
      this.cropStage = stage;
      this.crops.forEach((crop, index) => {
        const varied = Math.max(0, stage - (index % 11 < 5 && stage > 0 && index % 7 < 3 ? 1 : 0));
        crop.setFrame("wheat-" + varied).setVisible(stage >= 0);
      });
    }
    this.fieldBales.forEach((bale, i) => bale.setVisible(state.fieldStock.wheat > i * 4));
    this.syncProjects();
    for (const decoration of this.festivalDecor) decoration.setVisible(calendarNow.season === "autumn" && calendarNow.day === 4 && state.stats.festivalYear === calendarNow.year);
    for (const npc of state.villagers) {
      let actor = this.actors.get(npc.id);
      if (!actor) {
        const sprite = this.add.sprite(npc.x, npc.y, "village", `npc-${npc.color}-down-0`).setOrigin(0.5, 1).setScale(2);
        sprite.setInteractive({ useHandCursor: true });
        this.target(sprite, npc.name, () => this.controller.selectNpc(npc.id));
        const shadow = this.add.ellipse(npc.x, npc.y - 1, 24, 8, 0x374933, 0.22);
        const cargo = this.image("cargo-wheat", npc.x + 12, npc.y - 10, 1.6).setVisible(false);
        actor = { sprite, shadow, cargo }; this.actors.set(npc.id, actor);
      }
      const moving = npc.route.length > 0 && state.speed > 0;
      const working = this.isWorking(npc);
      const frame = (moving || working) && !this.reducedMotion ? Math.floor(state.elapsed * (moving ? 7 : 4) + npc.id) % 3 : 0;
      const isTractor = npc.role === "driver";
      const tractorFrame = npc.facing === "up" || npc.facing === "down" ? "tractor-" + npc.facing : "tractor";
      actor.sprite.setFrame(isTractor ? tractorFrame : `npc-${npc.color}-${npc.facing}-${frame}`)
        .setScale(isTractor ? 1.75 : 2).setFlipX(isTractor && npc.facing === "left");
      actor.sprite.setPosition(Math.round(npc.x), Math.round(npc.y) - (working && frame === 1 ? 2 : 0)).setDepth(npc.y);
      const sleeping = npc.job?.kind === "sleep" && !npc.route.length;
      actor.sprite.setVisible(!sleeping); actor.shadow.setVisible(!sleeping).setPosition(npc.x, npc.y - 1).setDepth(npc.y - 1);
      actor.cargo.setVisible(!!npc.cargo && !sleeping);
      if (npc.cargo) actor.cargo.setFrame(`cargo-${npc.cargo.resource}`).setPosition(npc.x + 12, npc.y - 12).setDepth(npc.y + 1);
    }
    this.showYield();
    this.selection.clear();
    if (snapshot.selectedNpc !== null) {
      const npc = state.villagers.find(v => v.id === snapshot.selectedNpc);
      if (npc) {
        this.selection.lineStyle(2, 0xfff2b4, 1).strokeEllipse(npc.x, npc.y, 36, 14);
        if (snapshot.followNpc) this.cameras.main.centerOn(npc.x, npc.y);
        if (npc.route.length) { this.selection.lineStyle(2, 0xfff4cc, 0.55).beginPath().moveTo(npc.x, npc.y); for (const p of npc.route) this.selection.lineTo(p.x, p.y); this.selection.strokePath(); }
      }
    }
    const plot = BUILD_SITES.find(site => site.id === snapshot.selectedPlace);
    if (plot) {
      const p = pointAt(plot);
      this.selection.lineStyle(2, 0xffe88a, 0.95).strokeEllipse(p.x, p.y, 68, 25);
    }
    const hour = calendarNow.hour + calendarNow.minute / 60;
    const night = hour >= 21 || hour < 6, dusk = hour >= 17 && hour < 21;
    this.lighting.setFillStyle(night ? 0x243a62 : 0xb87d51, night ? 0.33 : dusk ? (hour - 17) / 4 * 0.18 : 0);
    for (const light of this.windowLights) light.setAlpha(night || dusk ? 0.85 : 0);
    if (this.millSails && !this.reducedMotion) this.millSails.setRotation(state.elapsed / 14);
    this.drawAtmosphere(time, state.villagers);
    if (this.cursors && !snapshot.followNpc && !snapshot.offline) {
      const camera = this.cameras.main, amount = delta * 0.55 / camera.zoom;
      if (this.cursors.left.isDown) camera.scrollX -= amount;
      if (this.cursors.right.isDown) camera.scrollX += amount;
      if (this.cursors.up.isDown) camera.scrollY -= amount;
      if (this.cursors.down.isDown) camera.scrollY += amount;
    }
  }
  private isWorking(npc: Villager) {
    return !!npc.job && !npc.route.length && ["plant", "harvest", "pick", "tend", "build", "wood"].includes(npc.job.kind);
  }
  private showYield() {
    const { stats } = this.controller.state;
    const events = [
      { station: "market", amount: stats.earned - this.lastEarned, icon: "hud-coin" },
      { station: "wheat", amount: stats.harvestedWheat - this.lastHarvest, icon: "wheat-3" },
      { station: "orchard", amount: stats.harvestedApples - this.lastApples, icon: "cargo-apples" },
    ] as const;
    this.lastEarned = stats.earned;
    this.lastHarvest = stats.harvestedWheat;
    this.lastApples = stats.harvestedApples;
    for (const event of events) {
      if (event.amount <= 0) continue;
      const point = pointAt(STATIONS[event.station]);
      const text = this.add.text(10, 0, "+" + event.amount, {
        fontFamily: "Pixelify, sans-serif", fontSize: "22px", color: "#fff2a9", stroke: "#2e3223", strokeThickness: 4,
      }).setOrigin(0, 0.5);
      const icon = this.add.image(-2, 0, "village", event.icon).setScale(1.4);
      const popup = this.add.container(point.x, point.y - 28, [icon, text]).setDepth(2550);
      this.tweens.add({ targets: popup, y: popup.y - (this.reducedMotion ? 0 : 25), alpha: 0,
        duration: 1050, ease: "Quad.easeIn", onComplete: () => popup.destroy() });
    }
  }
  private drawAtmosphere(time: number, villagers: Villager[]) {
    this.atmosphere.clear();
    if (this.reducedMotion) return;
    for (const npc of villagers) {
      if (!this.isWorking(npc) || this.controller.state.speed === 0) continue;
      const phase = (this.controller.state.elapsed * 25 + npc.id * 7) % 24;
      if (phase >= 13) continue;
      this.atmosphere.fillStyle(npc.job?.kind === "pick" ? 0xf2c6a0 : 0xe5c177, 0.9 - phase / 20);
      this.atmosphere.fillRect(Math.round(npc.x + 9 + phase), Math.round(npc.y - 9 - Math.sin(phase / 6) * 9), 4, 3);
      this.atmosphere.fillRect(Math.round(npc.x + 16 - phase), Math.round(npc.y - 13 - phase / 2), 3, 3);
    }
    this.atmosphere.fillStyle(0xf2ecda, 0.35);
    for (const tile of HOME_TILES.slice(0, 4)) {
      const p = pointAt(tile);
      for (let i = 0; i < 3; i++) {
        const rise = (time / 180 + i * 13) % 39;
        this.atmosphere.fillRect(p.x + 27 + Math.sin(rise / 12) * 6, p.y - 140 - rise, 4 + rise / 9, 4);
      }
    }
    if (this.season === "winter") {
      this.atmosphere.fillStyle(0xffffff, 0.65);
      for (let i = 0; i < 65; i++) this.atmosphere.fillRect((i * 193 + Math.sin(time / 2000 + i) * 20) % WORLD_WIDTH, (i * 119 + time / 55) % WORLD_HEIGHT, 3, 3);
    } else {
      this.atmosphere.fillStyle(this.season === "autumn" ? 0xe8bc6b : 0xfff8d2, 0.7);
      for (let i = 0; i < 9; i++) {
        const x = 290 + i * 137 + Math.sin(time / 1700 + i) * 25, y = 420 + Math.cos(time / 2200 + i * 3) * 160;
        this.atmosphere.fillRect(x, y, 3, 2);
      }
    }
    // Lazy ripples make the stream feel alive without distracting from villagers.
    this.atmosphere.lineStyle(2, 0xc0e2db, 0.35);
    for (let i = 0; i < 12; i++) { const y = (i * 103 + time / 120) % WORLD_HEIGHT; const x = (36 + Math.sin(y / 32 / 5.8) * 1.35) * 32 + 10; this.atmosphere.lineBetween(x, y, x + 15, y); }
  }
}
