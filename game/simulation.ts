import type { Cargo, Job, JobKind, Project, ShipmentRoute, Station, Tile, VillageState, Villager } from "./types.ts";
import { BUILD_SITES, DAY_SECONDS, DAYS_PER_SEASON, HOME_TILES, SEASONS, SEASON_NAMES, STATIONS, findRoute, pointAt } from "./world.ts";

const NAMES = ["Mara", "Elsie", "Otto", "Theo", "Lily", "Finn", "Hazel", "Jasper", "Nora", "Arthur", "Rose", "Hugo", "Ivy", "Oscar", "Wren", "Felix", "Alice", "Milo", "Clara", "Robin", "Edith", "Leo", "Pearl", "Arlo"];
const ROLES = ["farmer", "merchant", "driver", "farmer", "gardener", "hauler", "gardener", "hauler", "baker", "carpenter", "farmer", "miller"] as const;
const STARTING_LOCATIONS: Tile[] = [
  { col: 17, row: 23 }, { col: 27, row: 21 }, { col: 14, row: 17 },
  { col: 13, row: 24 }, { col: 44, row: 14 }, { col: 15, row: 14 },
  { col: 46, row: 14 }, { col: 29, row: 18 }, { col: 26, row: 22 },
  { col: 11, row: 17 }, { col: 16, row: 20 }, { col: 23, row: 12 },
];
export function calendar(state: Pick<VillageState, "elapsed">) {
  const dayTotal = Math.floor(state.elapsed / DAY_SECONDS);
  const season = SEASONS[Math.floor(dayTotal / DAYS_PER_SEASON) % 4];
  const fraction = (state.elapsed % DAY_SECONDS) / DAY_SECONDS;
  const minutes = Math.floor((fraction * 1440 + 360) % 1440);
  return { season, year: Math.floor(dayTotal / (DAYS_PER_SEASON * 4)) + 1, day: dayTotal % DAYS_PER_SEASON + 1, dayTotal,
    hour: Math.floor(minutes / 60), minute: minutes % 60, fraction, night: minutes < 360 || minutes >= 1260 };
}
export function addEntry(state: VillageState, text: string, kind: "village" | "trade" | "build" | "season" = "village") {
  state.journal.unshift({ id: state.nextEventId++, day: Math.floor(state.elapsed / DAY_SECONDS), text, kind });
  state.journal = state.journal.slice(0, 50);
}
function makeVillager(id: number): Villager {
  const home = id % 4, pos = pointAt(HOME_TILES[home]);
  return { id, name: NAMES[id], role: ROLES[id % ROLES.length], color: id % 8, home,
    x: pos.x + (id % 3) * 7, y: pos.y, facing: "down", route: [], job: null, cargo: null, completed: 0 };
}
export function createVillage(): VillageState {
  const state: VillageState = {
    version: 1, elapsed: 32, coins: 240, inventory: { wheat: 24, apples: 16, flour: 0, bread: 0, wood: 85 },
    fieldStock: { wheat: 0, apples: 0 }, marketStock: { wheat: 12, apples: 8, flour: 0, bread: 0, wood: 0 },
    millInput: 0, millOutput: 0, bakeryInput: 0, bakeryOutput: 0,
    wheatGrowth: 0.93, appleGrowth: 0.3, priority: "balanced", speed: 1, priorityShipment: null,
    villagers: Array.from({ length: 12 }, (_, id) => makeVillager(id)), projects: [],
    journal: [], stats: { earned: 0, harvestedWheat: 0, harvestedApples: 0, breadBaked: 0, festivalYear: 0 }, nextEventId: 1,
  };
  for (const npc of state.villagers) Object.assign(npc, pointAt(STARTING_LOCATIONS[npc.id]));
  addEntry(state, "Pasar buka. Ladang gandum siap dipanen pagi ini.");
  return state;
}
export const hasBuilding = (state: VillageState, kind: string) => state.projects.some(p => p.kind === kind && p.complete);
export function openingGoalSite(state: VillageState) {
  if (state.stats.breadBaked > 0) return undefined;
  const id = hasBuilding(state, "mill") ? "bakery" : "mill";
  return BUILD_SITES.find(site => site.id === id);
}

export function wheatStage(state: VillageState) {
  if (calendar(state).season === "winter") return -1;
  if (state.wheatGrowth >= 1) return 3;
  if (state.wheatGrowth >= 0.45) return 2;
  if (state.wheatGrowth >= 0.15) return 1;
  return 0;
}
export function buildReason(state: VillageState, id: string): string | null {
  const site = BUILD_SITES.find(b => b.id === id);
  if (!site) return "Lokasi tidak ditemukan.";
  if (state.projects.some(p => p.id === id)) return "Bangunan sudah ada atau sedang dikerjakan.";
  if (site.requires && !hasBuilding(state, site.requires)) return "Bangun penggilingan terlebih dahulu.";
  if (state.coins < site.coins) return `Perlu ${site.coins - state.coins} koin lagi.`;
  if (state.inventory.wood < site.wood) return `Perlu ${site.wood - state.inventory.wood} kayu lagi.`;
  return null;
}
export function startBuilding(state: VillageState, id: string): string | null {
  const reason = buildReason(state, id);
  if (reason) return reason;
  const site = BUILD_SITES.find(b => b.id === id)!;
  state.coins -= site.coins; state.inventory.wood -= site.wood;
  state.projects.push({ id, kind: site.kind, col: site.col, row: site.row, remaining: site.seconds, complete: false });
  addEntry(state, `Arthur mulai membangun ${site.name.toLowerCase()}.`, "build");
  return null;
}
function job(kind: JobKind, station: Station, duration: number, extra: Partial<Job> = {}): Job {
  return { kind, station, duration, remaining: duration, ...extra };
}
export const SHIPMENTS = {
  "wheat-to-mill": { resource: "wheat", source: "barn", station: "barn", destination: "mill", minimum: 4, capacity: 16 },
  "flour-to-bakery": { resource: "flour", source: "mill", station: "mill", destination: "bakery", minimum: 2, capacity: 12 },
} as const;

function matchesShipment(cargo: Pick<Cargo, "resource" | "destination">, route: ShipmentRoute) {
  const { resource, destination } = SHIPMENTS[route];
  return cargo.resource === resource && cargo.destination === destination;
}

function shipmentReady(state: VillageState, route: ShipmentRoute) {
  const { minimum, capacity, destination } = SHIPMENTS[route];
  const [stock, input] = route === "wheat-to-mill" ? [state.inventory.wheat, state.millInput] : [state.millOutput, state.bakeryInput];
  return hasBuilding(state, destination) && stock >= minimum && input < capacity;
}

export function shipmentCarrier(state: VillageState, route: ShipmentRoute) {
  return state.villagers.find(npc => npc.cargo && matchesShipment(npc.cargo, route));
}

export function shipmentStatus(state: VillageState, route: ShipmentRoute) {
  if (shipmentCarrier(state, route)) return "in-transit";
  const { resource, destination, capacity } = SHIPMENTS[route];
  if (state.villagers.some(({ job }) => job?.kind === "collect" && job.resource === resource && job.destination === destination)) return "pickup";
  if ((route === "wheat-to-mill" ? state.millInput : state.bakeryInput) >= capacity) return "full";
  return shipmentReady(state, route) ? "waiting-carrier" : "waiting-stock";
}

export function setPriorityShipment(state: VillageState, route: ShipmentRoute | null) {
  if (route && !hasBuilding(state, SHIPMENTS[route].destination)) return "Selesaikan bangunan tujuan terlebih dahulu.";
  if (route && state.priorityShipment && state.priorityShipment !== route) return "Selesaikan atau batalkan arahan yang sedang aktif.";
  state.priorityShipment = route;
  return null;
}

function shipmentJob(route: ShipmentRoute) {
  const { resource, source, station, destination } = SHIPMENTS[route];
  return job("collect", station, 1.8, { resource, source, destination });
}

function hauling(state: VillageState): Job | null {
  const priority = state.priorityShipment;
  if (priority && shipmentStatus(state, priority) === "waiting-carrier") return shipmentJob(priority);
  if (!state.stats.breadBaked && shipmentReady(state, "flour-to-bakery")) return shipmentJob("flour-to-bakery");
  if (state.fieldStock.wheat >= 2) return job("collect", "wheat", 1.8, { resource: "wheat", source: "field", destination: "barn" });
  if (state.fieldStock.apples >= 2) return job("collect", "orchard", 1.8, { resource: "apples", source: "field", destination: "barn" });
  if (shipmentReady(state, "flour-to-bakery")) return shipmentJob("flour-to-bakery");
  if (state.bakeryOutput >= 2) return job("collect", "bakery", 1.8, { resource: "bread", source: "bakery", destination: "market" });
  if (shipmentReady(state, "wheat-to-mill")) return shipmentJob("wheat-to-mill");
  const reserve = state.priority === "stockpile" ? 24 : state.priority === "trade" ? 2 : 8;
  if (state.inventory.apples > reserve && state.marketStock.apples < 20)
    return job("collect", "barn", 1.8, { resource: "apples", source: "barn", destination: "market" });
  if (!hasBuilding(state, "mill") && state.inventory.wheat > reserve && state.marketStock.wheat < 20)
    return job("collect", "barn", 1.8, { resource: "wheat", source: "barn", destination: "market" });
  if (!hasBuilding(state, "bakery") && state.millOutput >= 3)
    return job("collect", "mill", 1.8, { resource: "flour", source: "mill", destination: "market" });
  return null;
}
function chooseJob(state: VillageState, npc: Villager): Job {
  if (npc.cargo) return job("deliver", npc.cargo.destination, 1.6);
  const time = calendar(state);
  const firstBread = !state.stats.breadBaked && state.projects.some(p => p.kind === "bakery");
  const openingNight = time.night && time.dayTotal === 0 && firstBread;
  // On opening day, the bakery and its delivery stay active for the first batch.
  if (openingNight && npc.role === "hauler" && shipmentReady(state, "flour-to-bakery")) return shipmentJob("flour-to-bakery");
  if (time.night && !(openingNight && npc.role === "baker")) return job("sleep", "home", 10);
  if (state.stats.festivalYear === time.year && time.season === "autumn" && time.day === 4 && time.hour >= 16)
    return job("festival", "plaza", 12);
  const project = state.projects.find(p => !p.complete);
  if (project && (npc.role === "carpenter" || (npc.role === "driver" && state.priority !== "trade")))
    return job("build", "plaza", 2, { projectId: project.id });
  if (firstBread && npc.role === "baker")
    return state.bakeryInput >= 2 && hasBuilding(state, "bakery") ? job("bake", "bakery", 8) : job("rest", "bakery", 2);
  if (npc.completed > 0 && npc.completed % 8 === 0) return job("rest", "plaza", 6);
  switch (npc.role) {
    case "farmer": case "driver":
      if (time.season === "winter") return hauling(state) ?? job("wood", "forest", 9);
      if (state.wheatGrowth >= 1 && !state.villagers.some(v => v.job?.kind === "harvest")) return job("harvest", "wheat", 7);
      return job("plant", "wheat", 5 + npc.id % 3);
    case "gardener":
      if (time.season === "autumn" && state.appleGrowth >= 1 && !state.villagers.some(v => v.job?.kind === "pick")) return job("pick", "orchard", 8);
      return time.season === "winter" ? hauling(state) ?? job("wood", "forest", 10) : job("tend", "orchard", 7);
    case "merchant": return job("sell", "market", state.priority === "trade" ? 3 : 5);
    case "miller":
      if (hasBuilding(state, "mill") && state.millInput >= 4) return job("mill", "mill", 7);
      return hauling(state) ?? job("rest", "plaza", 5);
    case "baker":
      if (hasBuilding(state, "bakery") && state.bakeryInput >= 2) return job("bake", "bakery", 8);
      return hauling(state) ?? job("rest", "plaza", 5);
    case "carpenter": return job("wood", "forest", 10);
    default: return hauling(state) ?? job("rest", "plaza", 4);
  }
}
function destinationFor(npc: Villager, state: VillageState): Tile {
  const current = npc.job!;
  if (current.station === "home") return HOME_TILES[npc.home] ?? HOME_TILES[0];
  if (current.kind === "build") {
    const project = state.projects.find(p => p.id === current.projectId);
    if (project) return { col: project.col, row: project.row + 1 };
  }
  const target = STATIONS[current.station];
  if (current.station === "wheat") return { col: target.col - (npc.id % 3), row: target.row + (npc.id % 2) };
  if (current.station === "orchard") return { col: target.col + npc.id % 2, row: target.row + npc.id % 3 };
  if (current.station === "plaza") return { col: target.col + npc.id % 4, row: target.row + npc.id % 2 };
  return target;
}
function finishProject(state: VillageState, project: Project) {
  project.complete = true; project.remaining = 0;
  const site = BUILD_SITES.find(b => b.id === project.id)!;
  addEntry(state, `${site.name} selesai! ${project.kind === "cottage" ? "Empat tetangga baru tiba di desa." : "Penduduk langsung menyiapkan kegiatan baru."}`, "build");
  if (project.kind === "cottage") {
    const count = Math.min(4, 24 - state.villagers.length);
    const home = 3 + state.projects.filter(p => p.kind === "cottage" && p.complete).length;
    for (let i = 0; i < count; i++) {
      const npc = makeVillager(state.villagers.length);
      npc.home = home; Object.assign(npc, pointAt(HOME_TILES[home])); state.villagers.push(npc);
    }
  }
}
function finishJob(state: VillageState, npc: Villager) {
  const current = npc.job!;
  switch (current.kind) {
    case "plant": state.wheatGrowth = Math.min(1, state.wheatGrowth + 0.025); break;
    case "harvest":
      if (state.wheatGrowth >= 0.95) { state.fieldStock.wheat += 16; state.stats.harvestedWheat += 16; state.wheatGrowth = 0.08; }
      break;
    case "tend": state.appleGrowth = Math.min(1, state.appleGrowth + 0.025); break;
    case "pick":
      if (state.appleGrowth >= 0.95) {
        const amount = hasBuilding(state, "orchard") ? 24 : 16;
        state.fieldStock.apples += amount; state.stats.harvestedApples += amount; state.appleGrowth = 0.15;
      } break;
    case "collect": {
      const resource = current.resource!;
      let available = 0;
      if (current.source === "field") available = state.fieldStock[resource as "wheat" | "apples"];
      else if (current.source === "mill") available = state.millOutput;
      else if (current.source === "bakery") available = state.bakeryOutput;
      else available = state.inventory[resource];
      const amount = Math.min(npc.role === "driver" ? 12 : 6, available);
      if (amount > 0) {
        if (current.source === "field") state.fieldStock[resource as "wheat" | "apples"] -= amount;
        else if (current.source === "mill") state.millOutput -= amount;
        else if (current.source === "bakery") state.bakeryOutput -= amount;
        else state.inventory[resource] -= amount;
        npc.cargo = { resource, amount, destination: current.destination! };
      } break;
    }
    case "deliver":
      if (npc.cargo) {
        const { resource, amount, destination } = npc.cargo;
        if (destination === "barn") state.inventory[resource] += amount;
        else if (destination === "mill") state.millInput += amount;
        else if (destination === "bakery") state.bakeryInput += amount;
        else state.marketStock[resource] += amount;
        if (state.priorityShipment && matchesShipment(npc.cargo, state.priorityShipment)) {
          state.priorityShipment = null;
          addEntry(state, `${npc.name} menyelesaikan kiriman yang didahulukan.`, "trade");
        }
        npc.cargo = null;
      } break;
    case "mill": if (state.millInput >= 4) { state.millInput -= 4; state.millOutput += 3; } break;
    case "bake":
      if (state.bakeryInput >= 2) {
        state.bakeryInput -= 2; state.bakeryOutput += 4;
        if (!state.stats.breadBaked) addEntry(state, `${npc.name} mengeluarkan roti pertama dari oven!`);
        state.stats.breadBaked += 4;
      }
      break;
    case "sell": {
      const prices = { bread: 8, flour: 5, apples: 3, wheat: 2, wood: 1 };
      const resource = (["bread", "flour", "apples", "wheat"] as const).find(r => state.marketStock[r] > 0);
      if (resource) {
        const count = Math.min(state.priority === "trade" ? 3 : 2, state.marketStock[resource]);
        const income = prices[resource] * count;
        state.marketStock[resource] -= count; state.coins += income; state.stats.earned += income;
      } break;
    }
    case "build": {
      const project = state.projects.find(p => p.id === current.projectId && !p.complete);
      if (project) { project.remaining -= 2; if (project.remaining <= 0) finishProject(state, project); }
      break;
    }
    case "wood": state.inventory.wood = Math.min(250, state.inventory.wood + 2); break;
  }
  npc.completed++; npc.job = null;
}
export function festivalGoals(state: VillageState) {
  return [hasBuilding(state, "mill"), hasBuilding(state, "bakery"), state.villagers.length >= 16, state.stats.earned >= 300];
}
export function advanceVillage(state: VillageState, seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  let remaining = seconds;
  while (remaining > 0.00001) {
    const dt = Math.min(1, remaining); remaining -= dt;
    const before = calendar(state); state.elapsed += dt; const after = calendar(state);
    if (before.season !== after.season) {
      addEntry(state, `${SEASON_NAMES[after.season]} tiba. ${after.season === "winter" ? "Ladang beristirahat, dapur dan bengkel tetap hangat." : after.season === "autumn" ? "Apel siap dipetik dan desa menyiapkan Festival Panen." : "Desa menyambut musim yang baru."}`, "season");
      for (const npc of state.villagers) if (!npc.cargo) { npc.job = null; npc.route = []; }
    }
    if (after.season !== "winter") state.wheatGrowth = Math.min(1, state.wheatGrowth + dt / 100);
    if (after.season === "autumn") state.appleGrowth = Math.min(1, state.appleGrowth + dt / 65);
    if (after.season === "autumn" && after.day === 4 && after.hour >= 16 && state.stats.festivalYear !== after.year && festivalGoals(state).every(Boolean)) {
      state.stats.festivalYear = after.year; state.coins += 120;
      addEntry(state, "Festival Panen dimulai! Warga berkumpul di pasar. Desa mendapat 120 koin hadiah.");
    }
    for (const npc of state.villagers) {
      if (!npc.job) { npc.job = chooseJob(state, npc); npc.route = findRoute(npc, destinationFor(npc, state)); }
      if (npc.route.length) {
        let distance = (npc.role === "driver" ? 36 : 30) * dt;
        while (npc.route.length && distance > 0) {
          const target = npc.route[0], dx = target.x - npc.x, dy = target.y - npc.y, length = Math.hypot(dx, dy);
          if (length > 0) npc.facing = Math.abs(dx) > Math.abs(dy) ? dx < 0 ? "left" : "right" : dy < 0 ? "up" : "down";
          if (length <= distance) { npc.x = target.x; npc.y = target.y; npc.route.shift(); distance -= length; }
          else { npc.x += dx / length * distance; npc.y += dy / length * distance; distance = 0; }
        }
      } else {
        npc.job.remaining -= dt;
        if (npc.job.remaining <= 0) finishJob(state, npc);
      }
    }
  }
}
export function activityText(npc: Villager): string {
  if (!npc.job) return "Menyiapkan kegiatan berikutnya";
  if (npc.route.length) {
    if (npc.job.kind === "build") return "Menuju lokasi pembangunan";
    if (npc.cargo) return `Mengantar ${npc.cargo.amount} ${({ wheat: "gandum", apples: "apel", flour: "tepung", bread: "roti", wood: "kayu" })[npc.cargo.resource]}`;
    return `Menuju ${({ wheat: "ladang gandum", orchard: "kebun apel", barn: "lumbung", market: "pasar", mill: "penggilingan", bakery: "toko roti", forest: "hutan", home: "rumah", plaza: "alun-alun" })[npc.job.station]}`;
  }
  if (npc.job.kind === "rest" && npc.job.station === "bakery") return "Menyiapkan dapur dan menunggu tepung";
  return ({ plant: "Merawat tanaman gandum", harvest: "Memanen gandum", tend: "Merawat pohon apel", pick: "Memetik apel", collect: "Memuat hasil produksi", deliver: "Menyimpan kiriman", mill: "Menggiling gandum", bake: "Memanggang roti", sell: "Melayani pembeli", build: "Membangun untuk desa", wood: "Mengumpulkan kayu", rest: "Beristirahat di alun-alun", sleep: "Beristirahat di rumah", festival: "Menikmati Festival Panen" })[npc.job.kind];
}
