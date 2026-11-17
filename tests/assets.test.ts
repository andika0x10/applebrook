import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COLS, ROWS } from "../game/world.ts";

const directory = new URL("../public/assets/applebrook/", import.meta.url);
const atlas = JSON.parse(readFileSync(new URL("village.json", directory), "utf8"));
const png = readFileSync(new URL("village.png", directory));
test("the Phaser atlas fits its PNG and contains every character direction and seasonal tree", () => {
  assert.equal(png.readUInt32BE(16), atlas.meta.size.w); assert.equal(png.readUInt32BE(20), atlas.meta.size.h);
  const frames = atlas.frames;
  for (let color = 0; color < 8; color++) for (const direction of ["up", "down", "left", "right"]) for (let step = 0; step < 3; step++) assert.ok(frames[`npc-${color}-${direction}-${step}`]);
  for (const season of ["spring", "summer", "autumn", "winter"]) for (const kind of ["tree", "apple"]) for (let variant = 0; variant < 3; variant++) assert.ok(frames[`${kind}-${season}-${variant}`]);
  for (const name of ["barn", "mill", "mill-sails", "bakery", "house-0", "house-1", "house-2", "tractor", "bridge", "market", "market-green", "construction", "orchard-shed", "build-sign", "well"]) assert.ok(frames[name], name);
  for (const entry of Object.values(frames) as { frame: { x: number; y: number; w: number; h: number } }[]) { const f = entry.frame; assert.ok(f.x + f.w <= 1024 && f.y + f.h <= 1024); }
});
test("all four terrain PNGs match the world's 2x rendering scale", () => {
  for (const season of ["spring", "summer", "autumn", "winter"]) {
    const image = readFileSync(new URL(`terrain-${season}.png`, directory));
    assert.equal(image.readUInt32BE(16) * 2, COLS * 32); assert.equal(image.readUInt32BE(20) * 2, ROWS * 32);
  }
});
