import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceVillage, calendar, createVillage, startBuilding, hasBuilding } from "../game/simulation.ts";
import { applyOffline, parseSave } from "../game/persistence.ts";
import { DAY_SECONDS, SEASON_SECONDS, STATIONS, findRoute, isBlocked, pointAt, tileAt } from "../game/world.ts";

test("a village runs unattended, harvests, transports, and earns money", () => {
  const state = createVillage();
  advanceVillage(state, 900);
  assert.ok(state.stats.harvestedWheat > 0);
  assert.ok(state.stats.earned > 0);
  assert.ok(state.villagers.every(npc => npc.completed > 0));
  assert.ok(Object.values(state.inventory).every(n => n >= 0));
});
test("building spends once, completes through workers, and opens the bread chain", () => {
  const state = createVillage(); state.coins = 2000;
  assert.equal(startBuilding(state, "bakery"), "Bangun penggilingan terlebih dahulu.");
  assert.equal(startBuilding(state, "mill"), null);
  const coins = state.coins;
  assert.ok(startBuilding(state, "mill")); assert.equal(state.coins, coins);
  advanceVillage(state, 150);
  assert.ok(hasBuilding(state, "mill"));
  assert.equal(startBuilding(state, "bakery"), null);
  advanceVillage(state, 600);
  assert.ok(hasBuilding(state, "bakery")); assert.ok(state.stats.breadBaked > 0);
});
test("new homes add four residents and never exceed 24", () => {
  const state = createVillage(); state.coins = 5000; state.inventory.wood = 250;
  for (const id of ["cottage-1", "cottage-2", "cottage-3"]) assert.equal(startBuilding(state, id), null);
  advanceVillage(state, 700);
  assert.equal(state.villagers.length, 24);
  assert.equal(new Set(state.villagers.map(n => n.id)).size, 24);
});
test("seasons cycle and winter keeps villagers working without wheat harvest", () => {
  const state = createVillage(); state.elapsed = SEASON_SECONDS * 3;
  const wheat = state.stats.harvestedWheat;
  advanceVillage(state, DAY_SECONDS);
  assert.equal(calendar(state).season, "winter"); assert.equal(state.stats.harvestedWheat, wheat);
  assert.ok(state.inventory.wood > 85);
  advanceVillage(state, SEASON_SECONDS);
  assert.equal(calendar(state).season, "spring"); assert.equal(calendar(state).year, 2);
});
test("offline progress is capped at one season, ignores speed multiplier, and respects pause", () => {
  const state = createVillage(); state.speed = 4;
  const elapsed = state.elapsed;
  const result = applyOffline(state, 0, 1000 * 86400)!;
  assert.equal(result.seconds, SEASON_SECONDS); assert.equal(state.elapsed, elapsed + SEASON_SECONDS);
  state.speed = 0;
  assert.equal(applyOffline(state, 0, 1000 * 86400), null);
});
test("save validation restores mid-job state and rejects corrupt, future, and invalid inventory data", () => {
  const state = createVillage(); advanceVillage(state, 90);
  const envelope = { version: 1, savedAt: 1000, state };
  assert.ok(parseSave(JSON.stringify(envelope), 1000));
  assert.equal(parseSave("{bad"), null);
  state.inventory.wheat = -1;
  assert.equal(parseSave(JSON.stringify(envelope), 1000), null);
  state.inventory.wheat = 1;
  state.villagers[0].job = { kind: "collect", station: "barn", duration: 1, remaining: 1 };
  assert.equal(parseSave(JSON.stringify(envelope), 1000), null);
});
test("routes to every work station cross the river at the bridge and avoid buildings", () => {
  for (const station of Object.values(STATIONS)) {
    const route = findRoute(pointAt({ col: 24, row: 18 }), station);
    assert.ok(route.length > 0);
    for (const point of route.slice(0, -1)) { const tile = tileAt(point); assert.equal(isBlocked(tile.col, tile.row), false); }
    assert.deepEqual(route.at(-1), pointAt(station));
  }
});

test("autumn apples are picked and physically delivered to the barn", () => {
  const state = createVillage(); state.elapsed = SEASON_SECONDS * 2; state.appleGrowth = 1;
  advanceVillage(state, 240);
  assert.ok(state.stats.harvestedApples > 0);
  const applesInTransit = state.villagers.reduce((total, npc) => total + (npc.cargo?.resource === "apples" ? npc.cargo.amount : 0), 0);
  assert.ok(state.fieldStock.apples + applesInTransit < state.stats.harvestedApples);
});

test("the harvest festival happens automatically once per eligible year", () => {
  const state = createVillage(); state.coins = 4000; state.inventory.wood = 250;
  startBuilding(state, "mill"); advanceVillage(state, 180);
  startBuilding(state, "bakery"); startBuilding(state, "cottage-1");
  advanceVillage(state, 600);
  state.stats.earned = Math.max(300, state.stats.earned);
  const festivalTime = SEASON_SECONDS * 2 + DAY_SECONDS * 3 + 150;
  advanceVillage(state, festivalTime - state.elapsed + 5);
  assert.equal(state.stats.festivalYear, 1);
  advanceVillage(state, 60);
  assert.equal(state.journal.filter(e => e.text.startsWith("Festival Panen dimulai!")).length, 1);
});
