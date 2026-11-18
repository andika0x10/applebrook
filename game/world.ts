import type { BuildingKind, Point, Station, Tile } from "./types.ts";

export const TILE = 32;
export const COLS = 54;
export const ROWS = 38;
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
export const pointAt = (tile: Tile): Point => ({ x: tile.col * TILE + TILE / 2, y: tile.row * TILE + TILE / 2 });
export const tileAt = (point: Point): Tile => ({ col: Math.floor(point.x / TILE), row: Math.floor(point.y / TILE) });
export function riverCenter(row: number) { return 36 + Math.sin(row / 5.8) * 1.35; }
export function isWater(col: number, row: number) { return Math.abs(col - riverCenter(row)) < 1.3; }
export function isRoad(col: number, row: number) {
  return (row >= 17 && row <= 18 && col >= 6 && col <= 48)
    || (col >= 24 && col <= 25 && row >= 4 && row <= 33)
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
  if (isWater(col, row) && !(row >= 17 && row <= 18)) return true;
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
