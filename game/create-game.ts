import Phaser from "phaser";
import { VillageScene } from "./VillageScene.ts";
import type { VillageController } from "./controller.ts";

export function createGame(parent: HTMLElement, controller: VillageController, ready: () => void, error: () => void) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#92ad75",
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    banner: false,
    audio: { noAudio: true },
    scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth, height: parent.clientHeight, autoCenter: Phaser.Scale.CENTER_BOTH },
    fps: { target: 60, min: 15 },
    scene: [new VillageScene(controller, ready, error)],
  });
}
