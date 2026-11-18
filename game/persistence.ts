import type { OfflineReport, VillageState } from "./types.ts";
import { createVillage, advanceVillage, addEntry, outingStation, REGIONAL_ACTIVITIES, SHIPMENTS } from "./simulation.ts";
import { BUILD_SITES, DAY_SECONDS, LANDMARKS, SEASON_SECONDS, WORLD_HEIGHT, WORLD_WIDTH } from "./world.ts";

export const SAVE_KEY = "applebrook.village.v1";
export interface SaveEnvelope { version: 1; savedAt: number; state: VillageState }
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const finite = (v: unknown, max = 1e12): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max;
const inventoryValid = (v: unknown) => isObject(v) && ["wheat", "apples", "flour", "bread", "wood"].every(k => finite(v[k]));
export function parseSave(raw: string | null, now = Date.now()): SaveEnvelope | null {
  if (!raw || raw.length > 500_000) return null;
  try {
    const save: unknown = JSON.parse(raw);
    if (!isObject(save) || save.version !== 1 || !finite(save.savedAt, now + 60_000) || !isObject(save.state)) return null;
    const s = save.state;
    if (s.version !== 1 || !finite(s.elapsed) || !finite(s.coins) || !inventoryValid(s.inventory) || !inventoryValid(s.marketStock)) return null;
    if (!isObject(s.fieldStock) || !finite(s.fieldStock.wheat) || !finite(s.fieldStock.apples)) return null;
    if (!["millInput", "millOutput", "bakeryInput", "bakeryOutput", "wheatGrowth", "appleGrowth", "nextEventId"].every(k => finite(s[k]))) return null;
    if (!finite(s.wheatGrowth, 1) || !finite(s.appleGrowth, 1)) return null;
    if (![0, 1, 2, 4].includes(s.speed as number) || !["balanced", "stockpile", "trade"].includes(s.priority as string)) return null;
    const priorityShipment = s.priorityShipment ?? null;
    if (priorityShipment !== null && (typeof priorityShipment !== "string" || !Object.hasOwn(SHIPMENTS, priorityShipment))) return null;
    const outingData = s.outings ?? {}, outings: VillageState["outings"] = {};
    if (!isObject(outingData)) return null;
    const active = new Map<number, string>();
    for (const [id, outing] of Object.entries(outingData)) {
      const site = LANDMARKS.find(landmark => landmark.id === id);
      if (!site || !isObject(outing)) return null;
      const activity = REGIONAL_ACTIVITIES[site.id];
      const phase = outing.phase;
      if (phase === "done") {
        if (!finite(outing.day, Math.floor(s.elapsed / DAY_SECONDS)) || !Number.isInteger(outing.day) || !finite(outing.amount, activity.reward.amount)) return null;
        outings[site.id] = { phase, day: outing.day, amount: outing.amount };
      } else if (phase === "outbound" || phase === "returning" || (phase === "supplies" && activity.cost)) {
        active.set(activity.worker, outingStation(site.id, phase));
        outings[site.id] = { phase };
      } else return null;
    }
    if (!Array.isArray(s.villagers) || s.villagers.length < 12 || s.villagers.length > 24) return null;
    const roles = ["farmer", "gardener", "hauler", "merchant", "driver", "carpenter", "miller", "baker"];
    const stations = ["wheat", "orchard", "barn", "market", "mill", "bakery", "forest", "home", "plaza"];
    const jobKinds = ["plant", "harvest", "tend", "pick", "collect", "deliver", "mill", "bake", "sell", "build", "wood", "rest", "sleep", "festival", "outing"];
    const resources = ["wheat", "apples", "flour", "bread", "wood"], ids = new Set<number>();
    for (const v of s.villagers) {
      if (!isObject(v) || !finite(v.id, 23) || ids.has(v.id as number) || typeof v.name !== "string" || v.name.length > 30 || !roles.includes(v.role as string)) return null;
      ids.add(v.id as number);
      if (!finite(v.x, WORLD_WIDTH) || !finite(v.y, WORLD_HEIGHT) || !finite(v.home, 6) || !finite(v.color, 7) || !finite(v.completed)) return null;
      if (!["left", "right", "up", "down"].includes(v.facing as string) || !Array.isArray(v.route) || v.route.length > 500) return null;
      if (!v.route.every(p => isObject(p) && finite(p.x, WORLD_WIDTH) && finite(p.y, WORLD_HEIGHT))) return null;
      if (v.job !== null) {
        if (!isObject(v.job) || !jobKinds.includes(v.job.kind as string) || !stations.includes(v.job.station as string) || !finite(v.job.duration, 60) || !finite(v.job.remaining, 60)) return null;
        if (v.job.kind === "collect" && (!resources.includes(v.job.resource as string) || !["field", "barn", "mill", "bakery"].includes(v.job.source as string) || !stations.includes(v.job.destination as string))) return null;
        if (v.job.source === "field" && !["wheat", "apples"].includes(v.job.resource as string)) return null;
        if (v.job.kind === "outing" && (active.get(v.id) !== v.job.station || v.cargo !== null)) return null;
      }
      if (v.cargo !== null && (!isObject(v.cargo) || !resources.includes(v.cargo.resource as string) || !finite(v.cargo.amount, 12) || !stations.includes(v.cargo.destination as string))) return null;
    }
    if ([...active.keys()].some(worker => !ids.has(worker))) return null;
    if (!Array.isArray(s.projects) || s.projects.length > BUILD_SITES.length) return null;
    const projectIds = new Set();
    for (const p of s.projects) {
      if (!isObject(p)) return null;
      const site = BUILD_SITES.find(b => b.id === p.id);
      if (!site || projectIds.has(p.id) || p.kind !== site.kind || p.col !== site.col || p.row !== site.row || !finite(p.remaining, site.seconds) || typeof p.complete !== "boolean") return null;
      projectIds.add(p.id);
    }
    if (!isObject(s.stats) || !["earned", "harvestedWheat", "harvestedApples", "breadBaked", "festivalYear"].every(k => finite((s.stats as Record<string, unknown>)[k]))) return null;
    if (!Array.isArray(s.journal) || s.journal.length > 50 || !s.journal.every(e => isObject(e) && finite(e.id) && finite(e.day) && typeof e.text === "string" && e.text.length < 500 && ["village", "trade", "build", "season"].includes(e.kind as string))) return null;
    s.priorityShipment = priorityShipment;
    s.outings = outings;
    return save as unknown as SaveEnvelope;
  } catch { return null; }
}
export function applyOffline(state: VillageState, savedAt: number, now = Date.now()): OfflineReport | null {
  const seconds = Math.min(SEASON_SECONDS, Math.max(0, (now - savedAt) / 1000));
  if (seconds < 15 || state.speed === 0) return null;
  const before = { ...state.stats, buildings: state.projects.filter(p => p.complete).length };
  const activeOutings = LANDMARKS.filter(({ id }) => state.outings[id] && state.outings[id].phase !== "done");
  advanceVillage(state, seconds);
  let completedOutings = 0, wildApples = 0;
  for (const { id } of activeOutings) {
    const outing = state.outings[id];
    if (outing?.phase !== "done") continue;
    completedOutings++;
    if (REGIONAL_ACTIVITIES[id].reward.resource === "apples") wildApples += outing.amount;
  }
  const report = {
    seconds, coins: state.stats.earned - before.earned, wheat: state.stats.harvestedWheat - before.harvestedWheat,
    apples: state.stats.harvestedApples - before.harvestedApples + wildApples, bread: state.stats.breadBaked - before.breadBaked,
    buildings: state.projects.filter(p => p.complete).length - before.buildings, outings: completedOutings,
  };
  addEntry(state, `Selama Anda pergi, desa menghasilkan ${report.coins} koin dan memanen ${report.wheat} gandum.`, "trade");
  return report;
}
export function loadVillage(storage: Pick<Storage, "getItem"> | null, now = Date.now()) {
  let saved: SaveEnvelope | null = null;
  try { saved = parseSave(storage?.getItem(SAVE_KEY) ?? null, now); } catch { /* Storage can be unavailable in private mode. */ }
  const state = saved?.state ?? createVillage();
  return { state, offline: saved ? applyOffline(state, saved.savedAt, now) : null, restored: !!saved };
}
