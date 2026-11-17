import { test } from "node:test";
import assert from "node:assert/strict";
import { VillageController } from "../game/controller.ts";
import { parseSave, SAVE_KEY } from "../game/persistence.ts";
import { createVillage } from "../game/simulation.ts";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
}
test("UI commands publish independent snapshots, persist choices, and pause the world", () => {
  const storage = new MemoryStorage(), controller = new VillageController(storage);
  const initial = controller.getSnapshot();
  let updates = 0;
  const unsubscribe = controller.subscribe(() => updates++);
  controller.setPriority("trade"); controller.setSpeed(4);
  controller.tick(0.1);
  assert.ok(Math.abs(controller.state.elapsed - initial.state.elapsed - 0.4) < 0.001);
  controller.setSpeed(0);
  const elapsed = controller.state.elapsed; controller.tick(0.1);
  assert.equal(controller.state.elapsed, elapsed);
  assert.equal(initial.state.priority, "balanced");
  assert.equal(controller.getSnapshot().state.priority, "trade");
  assert.equal(parseSave(storage.getItem(SAVE_KEY))?.state.speed, 0);
  assert.ok(updates >= 3);
  unsubscribe(); controller.destroy();
});
test("blocked browser storage continues in memory and reports its saving status", () => {
  const storage = new MemoryStorage();
  storage.getItem = () => { throw new Error("Blocked"); };
  storage.setItem = () => { throw new Error("Quota exceeded"); };
  const controller = new VillageController(storage);
  assert.doesNotThrow(() => controller.save());
  assert.equal(controller.getSnapshot().saved, "memory");
  assert.equal(controller.state.villagers.length, 12);
  controller.destroy();
});
test("acknowledging an offline report saves the progressed world without claiming it again", () => {
  const storage = new MemoryStorage(), state = createVillage();
  storage.setItem(SAVE_KEY, JSON.stringify({ version: 1, savedAt: Date.now() - 120_000, state }));
  const controller = new VillageController(storage);
  assert.ok(controller.getSnapshot().offline);
  assert.ok(controller.state.elapsed >= state.elapsed + 120);
  controller.dismissOffline();
  const reloaded = new VillageController(storage);
  assert.equal(reloaded.getSnapshot().offline, null);
  assert.equal(reloaded.state.elapsed, controller.state.elapsed);
  reloaded.destroy(); controller.destroy();
});
