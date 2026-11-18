import type { BuildingKind, Point, Station, Tile } from "./types.ts";

export const TILE = 32;
export const VILLAGE_COLS = 54;
export const VILLAGE_ROWS = 38;
export const COLS = 96;
export const ROWS = 72;
export const WORLD_WIDTH = COLS * TILE;
export const WORLD_HEIGHT = ROWS * TILE;
export const DAY_SECONDS = 360;
export const DAYS_PER_SEASON = 4;
export const SEASON_SECONDS = DAY_SECONDS * DAYS_PER_SEASON;
export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
export const SEASON_NAMES = { spring: "Musim semi", summer: "Musim panas", autumn: "Musim gugur", winter: "Musim dingin" };
export const ROLE_NAMES = { farmer: "Petani", gardener: "Pekebun apel", hauler: "Pengangkut", merchant: "Pedagang", driver: "Pengemudi traktor", carpenter: "Tukang kayu", miller: "Penggiling", baker: "Pembuat roti" };
export const RESOURCE_NAMES = { wheat: "Gandum", apples: "Apel", flour: "Tepung", bread: "Roti", wood: "Kayu" };
export const HOME_TILES: Tile[] = [{ col: 22, row: 10 }, { col: 28, row: 9 }, { col: 20, row: 6 }, { col: 29, row: 5 }, { col: 19, row: 30 }, { col: 32, row: 30 }, { col: 27, row: 33 }];
export const STATIONS: Record<Station, Tile> = {
  wheat: { col: 17, row: 23 }, orchard: { col: 44, row: 13 }, barn: { col: 12, row: 14 },
  market: { col: 27, row: 21 }, mill: { col: 12, row: 29 }, bakery: { col: 30, row: 28 },
  forest: { col: 9, row: 7 }, home: HOME_TILES[0], plaza: { col: 25, row: 20 },
};
export interface BuildSite { id: string; kind: BuildingKind; name: string; description: string; col: number; row: number; coins: number; wood: number; seconds: number; requires?: BuildingKind }
export const BUILD_SITES: BuildSite[] = [
  { id: "mill", kind: "mill", name: "Penggilingan", description: "Ubah gandum menjadi tepung. Buka langkah berikutnya menuju toko roti.", col: 12, row: 28, coins: 160, wood: 25, seconds: 26 },
  { id: "bakery", kind: "bakery", name: "Toko roti", description: "Olah tepung menjadi roti yang bisa dijual di pasar.", col: 30, row: 27, coins: 145, wood: 30, seconds: 32, requires: "mill" },
  { id: "cottage-1", kind: "cottage", name: "Rumah tepi ladang", description: "Empat tetangga baru siap menetap dan membantu pekerjaan desa.", col: 19, row: 29, coins: 180, wood: 20, seconds: 28 },
  { id: "orchard", kind: "orchard", name: "Perluasan kebun", description: "Lebih banyak pohon apel dan panen musim gugur yang berlimpah.", col: 44, row: 27, coins: 140, wood: 15, seconds: 22 },
  { id: "cottage-2", kind: "cottage", name: "Rumah dekat sungai", description: "Sambut empat penduduk lagi di lingkungan tepi sungai.", col: 32, row: 29, coins: 260, wood: 25, seconds: 30 },
  { id: "cottage-3", kind: "cottage", name: "Rumah selatan", description: "Lengkapi desa dengan empat keluarga pekerja baru.", col: 27, row: 32, coins: 340, wood: 30, seconds: 34 },
];
export const EAST_POND = { col: 61, row: 10, radiusX: 5.7, radiusY: 4.2 };
export const MARSH_POOLS = [
  { col: 39, row: 54, radiusX: 5, radiusY: 3.7 },
  { col: 52, row: 61.5, radiusX: 6.9, radiusY: 4.4 },
  { col: 38, row: 65, radiusX: 5.3, radiusY: 3.1 },
];
export const LOWER_CROSSING = { col: 45, row: 57.5 };
export const RIDGE_FACE = [[72, 28], [75, 26], [80, 28], [84, 26], [89, 27], [91, 30], [89, 33], [85, 33], [82, 35], [77, 34], [74, 35], [71, 32]];
export const LANDMARKS = [
  { id: "east-pond", name: "Telaga Timur", col: 61, row: 15, preview: "pond-dock", description: "Jalan di belakang kebun apel berakhir di dermaga kecil di tepi telaga." },
  { id: "south-meadow", name: "Padang Selatan", col: 20, row: 44, preview: "apple-autumn-1", description: "Pohon apel tua menaungi bangku di percabangan menuju hilir." },
  { id: "pine-ridge", name: "Tebing Pinus", col: 82, row: 25, preview: "ridge-lookout", description: "Di balik barisan pinus, pagar kayu menandai tempat melihat lereng berbatu." },
  { id: "lower-marsh", name: "Rawa Hilir", col: 48, row: 58, preview: "marsh-reeds-spring", description: "Jembatan papan melintasi sungai dan menghubungkan jalan tebing dengan padang selatan." },
] as const;
export type LandmarkId = typeof LANDMARKS[number]["id"];

export const pointAt = (tile: Tile): Point => ({ x: tile.col * TILE + TILE / 2, y: tile.row * TILE + TILE / 2 });
export const tileAt = (point: Point): Tile => ({ col: Math.floor(point.x / TILE), row: Math.floor(point.y / TILE) });
export function riverCenter(row: number) { return 36 + Math.sin(row / 5.8) * 1.35 + Math.max(0, row - VILLAGE_ROWS) * 0.42; }
export function riverHalfWidth(row: number) { return 1.3 + Math.min(1.25, Math.max(0, row - 44) * 0.065); }
export function isWater(col: number, row: number) {
  return Math.abs(col - riverCenter(row)) < riverHalfWidth(row)
    || waterBodies.some(pool => ((col - pool.col) / pool.radiusX) ** 2 + ((row - pool.row) / pool.radiusY) ** 2 < 1);
}
const waterBodies = [EAST_POND, ...MARSH_POOLS];

export function isCrossing(col: number, row: number) {
  return (row >= 17 && row <= 18 && col >= 33 && col <= 39)
    || (Math.abs(row - LOWER_CROSSING.row) <= 0.5 && Math.abs(col - LOWER_CROSSING.col) <= 10);
}

function isRidgeFace(col: number, row: number) {
  if (col < 71 || col > 91 || row < 26 || row > 35) return false;
  let inside = false;
  for (let i = 0, j = RIDGE_FACE.length - 1; i < RIDGE_FACE.length; j = i++) {
    const [x1, y1] = RIDGE_FACE[i], [x2, y2] = RIDGE_FACE[j];
    if ((y1 > row) !== (y2 > row) && col < x1 + (x2 - x1) * (row - y1) / (y2 - y1)) inside = !inside;
  }
  return inside;
}
export function isRoad(col: number, row: number) {
  return (row >= 17 && row <= 18 && col >= 6 && col <= 92)
    || (col >= 61 && col <= 62 && row >= 15 && row <= 18)
    || (col >= 24 && col <= 25 && row >= 4 && row <= 58)
    || (row === 44 && col >= 20 && col <= 25)
    || (col >= 44 && col <= 45 && row >= 28 && row <= 40)
    || (row === 40 && col >= 45 && col <= 66)
    || (col === 92 && row >= 18 && row <= 39)
    || (row === 39 && col >= 86 && col <= 92)
    || (col === 86 && row >= 39 && row <= 43)
    || (row === 43 && col >= 66 && col <= 86)
    || (col === 66 && row >= 40 && row <= 49)
    || (row === 49 && col >= 60 && col <= 66)
    || (col === 60 && row >= 49 && row <= 56)
    || (row === 56 && col >= 55 && col <= 60)
    || (col === 55 && row >= 56 && row <= 58)
    || (row >= 57 && row <= 58 && col >= 24 && col <= 55)
    || (col === 82 && row >= 18 && row <= 25)
    || (row === 25 && col >= 76 && col <= 82)
    || (row === 12 && col >= 11 && col <= 25)
    || (row === 9 && col >= 20 && col <= 30)
    || (row === 5 && col >= 20 && col <= 30)
    || (col === 12 && ((row >= 12 && row <= 18) || (row >= 27 && row <= 29)))
    || (col === 44 && row >= 11 && row <= 28)
    || (row === 28 && col >= 12 && col <= 32)
    || (col === 30 && row >= 18 && row <= 28)
    || (col >= 25 && col <= 30 && row >= 19 && row <= 22)
    || (row === 32 && col >= 24 && col <= 28);
}
export function isBlocked(col: number, row: number) {
  if (col < 2 || row < 2 || col >= COLS - 2 || row >= ROWS - 2) return true;
  if (isRidgeFace(col, row) || (isWater(col, row) && !isCrossing(col, row))) return true;
  const structures = [
    [10, 10, 5, 4], [20, 7, 4, 3], [27, 6, 4, 3], [19, 3, 4, 3], [28, 2, 4, 3],
    [10, 25, 4, 4], [28, 24, 5, 4], [18, 27, 4, 3], [31, 27, 4, 3], [26, 30, 4, 3],
  ];
  return structures.some(([x, y, w, h]) => col >= x && col < x + w && row >= y && row < y + h);
}

// Weighted A*: lanes are preferred; water and building footprints are obstacles.
const routeCache = new Map<string, Point[]>();
export function findRoute(start: Point, destination: Tile): Point[] {
  const from = tileAt(start), key = `${from.col},${from.row}:${destination.col},${destination.row}`;
  const cached = routeCache.get(key);
  if (cached) return cached.map(p => ({ ...p }));
  const encode = (col: number, row: number) => row * COLS + col;
  const startId = encode(from.col, from.row), goal = encode(destination.col, destination.row);
  if (startId === goal) return [];
  const open = new Set([startId]), previous = new Map<number, number>(), g = new Map([[startId, 0]]);
  const heuristic = (id: number) => Math.abs(id % COLS - destination.col) + Math.abs(Math.floor(id / COLS) - destination.row);
  const f = new Map([[startId, heuristic(startId)]]);
  let reached = false;
  for (let attempts = 0; open.size && attempts < COLS * ROWS; attempts++) {
    let current = -1, best = Infinity;
    for (const candidate of open) { const score = f.get(candidate) ?? Infinity; if (score < best) { current = candidate; best = score; } }
    if (current === goal) { reached = true; break; }
    open.delete(current);
    const col = current % COLS, row = Math.floor(current / COLS);
    for (const [dc, dr] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nc = col + dc, nr = row + dr;
      if (isBlocked(nc, nr) && encode(nc, nr) !== goal) continue;
      const neighbor = encode(nc, nr), score = (g.get(current) ?? Infinity) + (isRoad(nc, nr) ? 1 : 2.4);
      if (score >= (g.get(neighbor) ?? Infinity)) continue;
      previous.set(neighbor, current); g.set(neighbor, score); f.set(neighbor, score + heuristic(neighbor)); open.add(neighbor);
    }
  }
  if (!reached) return [];
  const route: Point[] = [];
  let cursor = goal;
  while (cursor !== startId) { route.unshift(pointAt({ col: cursor % COLS, row: Math.floor(cursor / COLS) })); cursor = previous.get(cursor)!; }
  if (routeCache.size > 1500) routeCache.clear();
  routeCache.set(key, route);
  return route.map(p => ({ ...p }));
}
