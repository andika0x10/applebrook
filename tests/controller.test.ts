import { test } from "node:test";
import assert from "node:assert/strict";
import { VillageController } from "../game/controller.ts";
import { parseSave, SAVE_KEY } from "../game/persistence.ts";
import { advanceVillage, createVillage, shipmentCarrier, shipmentStatus } from "../game/simulation.ts";
import { pointAt, STATIONS } from "../game/world.ts";

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
test("a version-one save without a priority shipment restores all existing progress", () => {
  const state = createVillage();
  state.coins = 74;
  advanceVillage(state, 60);
  const { priorityShipment, ...legacyState } = state;
  const save = parseSave(JSON.stringify({ version: 1, savedAt: 1000, state: legacyState }), 1000);
  assert.deepEqual(save?.state, state);
});
test("a prioritized shipment resumes in transit and delivers its stock once", () => {
  const storage = new MemoryStorage(), controller = new VillageController(storage);
  assert.ok(controller.prioritizeShipment("wheat-to-mill"));
  assert.equal(controller.build("mill"), null);
  advanceVillage(controller.state, 30);
  assert.equal(controller.prioritizeShipment("wheat-to-mill"), null);
  const state = controller.state;
  for (let i = 0; i < 90 && !shipmentCarrier(state, "wheat-to-mill"); i++) advanceVillage(state, 1);

  const carrier = shipmentCarrier(state, "wheat-to-mill");
  assert.ok(carrier?.cargo);
  assert.equal(shipmentStatus(state, "wheat-to-mill"), "in-transit");
  controller.save();
  const restored = new VillageController(storage);
  assert.deepEqual(restored.state, state);

  const rider = restored.state.villagers.find(npc => npc.id === carrier.id)!;
  const amount = rider.cargo!.amount;
  for (const npc of restored.state.villagers) {
    npc.route = [];
    npc.job = npc.id === rider.id
      ? { kind: "deliver", station: "mill", duration: 1.6, remaining: 1 }
      : { kind: "rest", station: "plaza", duration: 5, remaining: 5 };
  }
  Object.assign(rider, pointAt(STATIONS.mill));
  const before = restored.state.millInput;
  restored.tick(0.1);
  assert.equal(restored.state.priorityShipment, "wheat-to-mill");
  advanceVillage(restored.state, 1);
  assert.equal(restored.state.priorityShipment, null);
  assert.equal(rider.cargo, null);
  assert.equal(restored.state.millInput, before + amount);
  advanceVillage(restored.state, 1);
  assert.equal(restored.state.millInput, before + amount);
});
test("canceling a priority leaves an existing cargo in flight", () => {
  const controller = new VillageController(null);
  controller.build("mill");
  advanceVillage(controller.state, 30);
  assert.equal(controller.prioritizeShipment("wheat-to-mill"), null);
  for (let i = 0; i < 90 && !shipmentCarrier(controller.state, "wheat-to-mill"); i++) advanceVillage(controller.state, 1);
  const carrier = shipmentCarrier(controller.state, "wheat-to-mill");
  assert.ok(carrier?.cargo);
  const cargo = structuredClone(carrier.cargo);

  assert.equal(controller.prioritizeShipment(null), null);
  assert.equal(controller.state.priorityShipment, null);
  assert.deepEqual(carrier.cargo, cargo);
});
