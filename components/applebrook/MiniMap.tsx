import type { VillageController } from "@/game/controller";
import type { VillageState } from "@/game/types";
import { COLS, EAST_POND, HOME_TILES, LANDMARKS, LOWER_CROSSING, MARSH_POOLS, RIDGE_FACE, ROWS, WORLD_HEIGHT, WORLD_WIDTH, isRoad, pointAt, riverCenter, riverHalfWidth, type LandmarkId } from "@/game/world";
import Icon from "./Icons";

const roads = Array.from({ length: ROWS }, (_, row) => Array.from({ length: COLS }, (_, col) => isRoad(col, row) ? `M${col},${row}h1v1h-1Z` : "").join("")).join("");
const banks = Array.from({ length: ROWS + 1 }, (_, row) => ({
  west: `${riverCenter(row) + 0.5 - riverHalfWidth(row)},${row}`,
  east: `${riverCenter(row) + 0.5 + riverHalfWidth(row)},${row}`,
}));
const river = `M${banks.map(p => p.west).join("L")}L${banks.map(p => p.east).reverse().join("L")}Z`;
const ridge = RIDGE_FACE.map(([x, y]) => `${x + 0.5},${y + 0.5}`).join(" ");
export default function MiniMap({ state, controller, onVisit }: { state: VillageState; controller: VillageController; onVisit: (id: LandmarkId) => void }) {
  return <div className="minimap"><div className="minimap-heading"><Icon name="map" size={13}/><span>Peta desa</span></div><svg role="button" aria-label="Peta desa, klik untuk memindahkan kamera" tabIndex={0} viewBox={`0 0 ${COLS} ${ROWS}`} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); controller.camera({ type: "home" }); } }} onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); controller.camera({ type: "pan", x: (e.clientX - rect.left) / rect.width * WORLD_WIDTH, y: (e.clientY - rect.top) / rect.height * WORLD_HEIGHT }); }}>
    <rect width={COLS} height={ROWS} fill="#94ad75"/>
    <path d={`M0,0H${COLS}V3H0ZM0,${ROWS - 3}H${COLS}V${ROWS}H0ZM0,0H4V${ROWS}H0ZM${COLS - 3},0H${COLS}V${ROWS}H${COLS - 3}Z`} fill="#718c58"/>
    <ellipse cx="20" cy="44" rx="9.5" ry="4.5" fill="#abc082"/>
    <polygon points={ridge} fill="#817b69" stroke="#6e705a" strokeWidth="0.5"/>
    <path d={roads} fill="#d6c295"/>
    {MARSH_POOLS.map(pool => <ellipse key={pool.col} cx={pool.col + 0.5} cy={pool.row + 0.5} rx={pool.radiusX} ry={pool.radiusY} fill="#73998e"/>)}
    <path d={river} fill="#7ba6a6"/>
    <ellipse cx={EAST_POND.col + 0.5} cy={EAST_POND.row + 0.5} rx={EAST_POND.radiusX} ry={EAST_POND.radiusY} fill="#679c9e"/>
    <rect x={riverCenter(18) - 1.25} y="17.2" width="3.5" height="1.55" fill="#d6c295"/>
    <rect x={LOWER_CROSSING.col - 9.5} y={LOWER_CROSSING.row - 0.35} width="20" height="1.7" fill="#bf9d6f"/>
    <rect x="8" y="20" width="11" height="6" rx="0.5" fill="#d2b36b"/>
    <rect x="41" y="7" width="9" height="9" rx="2" fill="#718a54"/>
    {HOME_TILES.slice(0, 4).map((p, i) => <rect key={i} x={p.col - 1} y={p.row - 2} width="2.5" height="2" fill="#ede0ba"/>)}
    <rect x="10" y="10" width="4" height="3.5" fill="#b5735b"/><rect x="26" y="19" width="3" height="2" fill="#e0b191"/>
    {state.projects.filter(p => p.complete).map(p => <rect key={p.id} x={p.col - 1} y={p.row - 1} width="2.5" height="2" fill="#e8d8ac"/>)}
    {state.villagers.map(npc => <circle key={npc.id} cx={npc.x / WORLD_WIDTH * COLS} cy={npc.y / WORLD_HEIGHT * ROWS} r="0.4" fill="#fff8d4"/>)}
    {LANDMARKS.map(landmark => <circle key={landmark.id} cx={landmark.col + 0.5} cy={landmark.row + 0.5} r="1.2" fill="#ffe3a0" stroke="#574b33" strokeWidth="0.45"/>)}
  </svg><div className="minimap-places">
    {LANDMARKS.map(landmark => <button key={landmark.id} type="button" onClick={() => {
      onVisit(landmark.id);
      controller.camera({ type: "pan", ...pointAt(landmark), revealPanel: true });
    }}>{landmark.name}</button>)}
  </div></div>;
}
