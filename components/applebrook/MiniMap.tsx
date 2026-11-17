import type { VillageController } from "@/game/controller";
import type { VillageState } from "@/game/types";
import { COLS, ROWS, HOME_TILES, isRoad, riverCenter, WORLD_HEIGHT, WORLD_WIDTH } from "@/game/world";
import Icon from "./Icons";

const roads = Array.from({ length: ROWS }, (_, row) => Array.from({ length: COLS }, (_, col) => isRoad(col, row) ? `M${col},${row}h1v1h-1Z` : "").join("")).join("");
const river = Array.from({ length: ROWS + 1 }, (_, row) => `${row ? "L" : "M"}${riverCenter(row) + 0.5},${row}`).join(" ");
export default function MiniMap({ state, controller }: { state: VillageState; controller: VillageController }) {
  return <div className="minimap"><div className="minimap-heading"><Icon name="map" size={13}/><span>Peta desa</span></div><svg role="button" aria-label="Peta desa, klik untuk memindahkan kamera" tabIndex={0} viewBox={`0 0 ${COLS} ${ROWS}`} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); controller.camera({ type: "home" }); } }} onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); controller.camera({ type: "pan", x: (e.clientX - rect.left) / rect.width * WORLD_WIDTH, y: (e.clientY - rect.top) / rect.height * WORLD_HEIGHT }); }}>
    <rect width={COLS} height={ROWS} fill="#94ad75"/><path d={roads} fill="#d6c295"/><path d={river} fill="none" stroke="#7ba6a6" strokeWidth="2.8"/>
    <path d={`M0,0H54V3H0ZM0,35H54V38H0ZM0,0H4V38H0ZM51,0H54V38H51Z`} fill="#718c58"/>
    <rect x="8" y="20" width="11" height="6" rx="0.5" fill="#d2b36b"/>
    <rect x="41" y="7" width="9" height="9" rx="2" fill="#718a54"/>
    {HOME_TILES.slice(0, 4).map((p, i) => <rect key={i} x={p.col - 1} y={p.row - 2} width="2.5" height="2" fill="#ede0ba"/>)}
    <rect x="10" y="10" width="4" height="3.5" fill="#b5735b"/><rect x="26" y="19" width="3" height="2" fill="#e0b191"/>
    {state.projects.filter(p => p.complete).map(p => <rect key={p.id} x={p.col - 1} y={p.row - 1} width="2.5" height="2" fill="#e8d8ac"/>)}
    {state.villagers.map(npc => <circle key={npc.id} cx={npc.x / WORLD_WIDTH * COLS} cy={npc.y / WORLD_HEIGHT * ROWS} r="0.4" fill="#fff8d4"/>)}
  </svg></div>;
}
