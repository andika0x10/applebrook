import { useEffect, useRef } from "react";
import type { VillageController } from "@/game/controller";
import type { Priority, Resource, ShipmentRoute, Snapshot, VillageState } from "@/game/types";
import { activityText, buildReason, calendar, festivalGoals, hasBuilding, SHIPMENTS, shipmentStatus, wheatStage } from "@/game/simulation";
import { villagerFrame } from "@/game/sprites";
import { BUILD_SITES, RESOURCE_NAMES, ROLE_NAMES, SEASON_NAMES } from "@/game/world";
import Icon from "./Icons";
import PixelSprite from "./PixelSprite";

export type Panel = "build" | "villagers" | "priority" | "journal" | "guide" | "festival" | "stock";
export const STOCK_ICONS: Record<Resource, string> = { wheat: "wheat", apples: "apple", flour: "flour", bread: "bread", wood: "wood" };
export function totalStock(state: VillageState, resource: Resource) {
  let count = state.inventory[resource] + state.marketStock[resource];
  if (resource === "wheat") count += state.fieldStock.wheat + state.millInput;
  if (resource === "apples") count += state.fieldStock.apples;
  if (resource === "flour") count += state.millOutput + state.bakeryInput;
  if (resource === "bread") count += state.bakeryOutput;
  for (const npc of state.villagers) if (npc.cargo?.resource === resource) count += npc.cargo.amount;
  return count;
}
function Progress({ value }: { value: number }) { return <div className="progress-track"><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>; }
const SHIPMENT_LABELS: Record<ShipmentRoute, string> = {
  "wheat-to-mill": "Gandum ke Penggilingan",
  "flour-to-bakery": "Tepung ke Toko Roti",
};
const SHIPMENT_STATUS = {
  "waiting-stock": "Menunggu bahan tersedia",
  "waiting-carrier": "Menunggu pengangkut",
  pickup: "Pengangkut menuju tempat pengambilan",
  "in-transit": "Dalam perjalanan",
  full: "Menunggu ruang di bangunan tujuan",
};

function ShipmentControls({ state, controller, routes }: { state: VillageState; controller: VillageController; routes: ShipmentRoute[] }) {
  return <section className="shipment-controls" aria-label="Dahulukan kiriman">
    {routes.length > 1 && <h3>Dahulukan kiriman</h3>}
    {routes.map(route => {
      const active = state.priorityShipment === route;
      const ready = hasBuilding(state, SHIPMENTS[route].destination);
      const blocked = !ready || (!active && state.priorityShipment !== null);
      const status = active ? SHIPMENT_STATUS[shipmentStatus(state, route)] : !ready ? "Selesaikan bangunan tujuan dulu." : blocked ? "Ada arahan lain yang sedang aktif." : null;
      return <div className="shipment-option" key={route}>
        <div className="shipment-label">
          <Icon name={STOCK_ICONS[SHIPMENTS[route].resource]} size={18}/>
          <strong>{SHIPMENT_LABELS[route]}</strong>
        </div>
        <div className="shipment-status" aria-live="polite">{status}</div>
        <button className="small-button" type="button" disabled={blocked}
          aria-label={`${active ? "Batalkan kiriman" : "Dahulukan kiriman"} ${SHIPMENT_LABELS[route].toLowerCase()}`}
          onClick={() => controller.prioritizeShipment(active ? null : route)}>
          {active ? "Batalkan arahan" : "Dahulukan kiriman"}
        </button>
      </div>;
    })}
  </section>;
}
const PANEL_META: Record<Panel, { title: string; icon: string }> = {
  build: { title: "Pembangunan", icon: "build" },
  villagers: { title: "Warga", icon: "people" },
  priority: { title: "Prioritas kerja", icon: "sliders" },
  journal: { title: "Catatan desa", icon: "book" },
  guide: { title: "Kontrol", icon: "help" },
  festival: { title: "Festival panen", icon: "flag" },
  stock: { title: "Persediaan", icon: "barn" },
};
export function VillagePanel({ panel, snapshot, controller, onClose, onBuild }: { panel: Panel; snapshot: Snapshot; controller: VillageController; onClose: () => void; onBuild: (id: string) => void }) {
  const state = snapshot.state, meta = PANEL_META[panel], ref = useRef<HTMLElement>(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, [panel]);
  return <aside ref={ref} className={`village-panel panel-${panel}`} tabIndex={-1} role="dialog" aria-labelledby="panel-title">
    <div className="panel-heading"><span className="panel-heading-icon"><Icon name={meta.icon} size={22} /></span><h2 id="panel-title">{meta.title}</h2><button className="icon-button" onClick={onClose} aria-label="Tutup panel"><Icon name="close" size={18}/></button></div>
    <div className="panel-scroll">
      {panel === "build" && <div className="build-list">{BUILD_SITES.map(site => {
        const project = state.projects.find(p => p.id === site.id), reason = buildReason(state, site.id);
        return <article className={`build-item ${project?.complete ? "is-complete" : ""}`} key={site.id}>
          <div className="build-item-main"><span className="building-preview"><PixelSprite name={site.kind === "cottage" ? "house-1" : site.kind === "orchard" ? "apple-autumn-0" : site.kind} size={64}/></span><div><h3>{site.name}</h3><p>{site.description}</p></div></div>
          {project ? project.complete ? <span className="complete-label"><Icon name="check" size={15}/> Sudah menjadi bagian desa</span> : <><div className="build-progress-label"><span>Sedang dibangun</span><span>{Math.round((1 - project.remaining / site.seconds) * 100)}%</span></div><Progress value={(1 - project.remaining / site.seconds) * 100}/></> : <><div className="build-item-bottom"><span className="build-price"><Icon name="coin" size={16}/>{site.coins}<Icon name="wood" size={16}/>{site.wood}</span><button className="small-button" disabled={!!reason} onClick={() => onBuild(site.id)}>Bangun <Icon name="plus" size={14}/></button></div>{reason && <p className="build-reason">{reason}</p>}</>}
        </article>;
      })}</div>}
      {panel === "villagers" && <><div className="panel-note"><span className="live-dot"/>{state.villagers.length} penduduk menjalani hari mereka</div><div className="villager-list">{state.villagers.map(npc => <button className="villager-row" key={npc.id} onClick={() => { controller.selectNpc(npc.id); controller.camera({ type: "pan", x: npc.x, y: npc.y, revealPanel: true }); }}><span className="portrait"><PixelSprite name={villagerFrame(npc, "down", 0)} size={40}/></span><span className="villager-copy"><strong>{npc.name}<span>{ROLE_NAMES[npc.role]}</span></strong><small>{activityText(npc)}</small></span><Icon name="chevron" size={16}/></button>)}</div></>}
      {panel === "priority" && <>
        <ShipmentControls state={state} controller={controller} routes={["wheat-to-mill", "flour-to-bakery"]}/>
        <h3 className="section-title">Kebijakan desa</h3>
        <div className="priority-options">{([{ id: "balanced", icon: "leaf", title: "Tumbuh seimbang", text: "Simpan bekal secukupnya, olah hasil panen, dan jual sisanya." }, { id: "stockpile", icon: "barn", title: "Isi lumbung", text: "Simpan lebih banyak gandum dan apel untuk musim berikutnya." }, { id: "trade", icon: "coin", title: "Ramaikan pasar", text: "Kurangi cadangan dan layani pembeli lebih cepat." }] as { id: Priority; icon: string; title: string; text: string }[]).map(option => <button key={option.id} className={`priority-option ${state.priority === option.id ? "is-selected" : ""}`} onClick={() => controller.setPriority(option.id)} aria-pressed={state.priority === option.id}><Icon name={option.icon} size={26}/><span><strong>{option.title}</strong><small>{option.text}</small></span><span className="radio-indicator">{state.priority === option.id && <Icon name="check" size={13}/>}</span></button>)}</div>
      </>}
      {panel === "journal" && <div className="journal-list">{state.journal.map(entry => <article className="journal-entry" key={entry.id}><span className={`journal-symbol ${entry.kind}`}><Icon name={entry.kind === "build" ? "build" : entry.kind === "season" ? "leaf" : entry.kind === "trade" ? "coin" : "house"} size={16}/></span><div><small>Hari desa ke-{entry.day + 1}</small><p>{entry.text}</p></div></article>)}</div>}
      {panel === "stock" && <><div className="stock-list">{(["wheat", "apples", "flour", "bread", "wood"] as Resource[]).map(resource => <div className="stock-row" key={resource}><span className={`resource-icon resource-${resource}`}><Icon name={STOCK_ICONS[resource]} size={24}/></span><div><strong>{RESOURCE_NAMES[resource]}</strong><small>{state.inventory[resource]} di lumbung, {state.marketStock[resource]} di pasar</small></div><b>{totalStock(state, resource)}</b></div>)}</div><h3 className="section-title">Perjalanan hasil panen</h3><div className="production-chain"><span><Icon name="wheat"/>Gandum</span><Icon name="chevron" size={12}/><span><Icon name="flour"/>Tepung</span><Icon name="chevron" size={12}/><span><Icon name="bread"/>Roti</span></div><p className="quiet-note">Jumlah di atas termasuk barang di ladang, tempat produksi, pasar, dan yang sedang diangkut.</p><div className="earnings-note"><Icon name="coin" size={24}/><span>Total hasil perdagangan<strong>{state.stats.earned.toLocaleString("id-ID")} koin</strong></span></div></>}
      {panel === "festival" && <><div className="festival-illustration"><PixelSprite name="market" size={95}/><span className="festival-confetti">✦</span><PixelSprite name="npc-1-down-0" size={45}/><PixelSprite name="npc-4-down-0" size={45}/></div><p className="body-copy">Festival berlangsung pada sore terakhir musim gugur jika semua persiapan selesai.</p><div className="festival-goals">{["Bangun penggilingan", "Buka toko roti", "Sambut 16 penduduk", "Hasilkan 300 koin dari pasar"].map((goal, i) => <div key={goal} className={festivalGoals(state)[i] ? "goal-done" : ""}><span>{festivalGoals(state)[i] ? <Icon name="check" size={14}/> : <span/>}</span>{goal}</div>)}</div><div className="panel-note"><Icon name="flag" size={16}/>{state.stats.festivalYear === calendar(state).year ? "Festival tahun ini sudah dirayakan!" : `${festivalGoals(state).filter(Boolean).length} dari 4 persiapan selesai`}</div></>}
      {panel === "guide" && <><div className="guide-lead"><PixelSprite name="tree-spring-0" size={70}/><p>Warga bekerja otomatis. Klik warga untuk melihat pekerjaan dan rutenya.</p></div><div className="guide-section"><h3>Pembangunan</h3><p>Buka menu Bangun dan buat penggilingan pertama. Arthur akan mengerjakannya; Hugo akan mengolah gandum setelah bangunan siap.</p></div><div className="guide-section"><h3>Ikuti warga</h3><p>Klik warga di peta atau daftar penduduk. Pilih Ikuti untuk menemani perjalanan mereka dan melihat barang yang diangkut.</p></div><div className="guide-section"><h3>Musim</h3><p>Satu hari berlangsung 6 menit dan satu musim terdiri dari 4 hari. Apel dipanen saat gugur. Saat dingin, warga mengangkut bekal, membuat roti, dan mengumpulkan kayu.</p></div><div className="guide-section"><h3>Penyimpanan dan waktu offline</h3><p>Progres tersimpan di browser ini setiap 8 detik. Saat Anda pergi, pekerjaan dihitung hingga 24 menit pada kecepatan normal. Menjeda game juga menjeda hasil offline.</p></div><h3 className="section-title">Kontrol sederhana</h3><div className="shortcut-list"><span>Geser peta</span><kbd>Tarik / ← ↑ ↓ →</kbd><span>Perbesar / perkecil</span><kbd>Scroll</kbd><span>Jeda / lanjutkan</span><kbd>Spasi</kbd><span>Kembali ke tengah</span><kbd>H</kbd><span>Bangun / penduduk</span><kbd>B / N</kbd><span>Tutup panel</span><kbd>Esc</kbd></div></>}
    </div>
  </aside>;
}

export function SelectionCard({ snapshot, controller, onBuild, onClose }: { snapshot: Snapshot; controller: VillageController; onBuild: (id: string) => void; onClose: () => void }) {
  const state = snapshot.state, npc = state.villagers.find(v => v.id === snapshot.selectedNpc), place = snapshot.selectedPlace;
  const project = state.projects.find(p => p.id === place);
  const ref = useRef<HTMLElement>(null);
  const ordered = !!project;
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, [place, snapshot.selectedNpc, ordered]);
  if (npc) return <aside ref={ref} className="selection-card" tabIndex={-1} aria-label={`Tentang ${npc.name}`}><button className="icon-button card-close" onClick={onClose} aria-label="Tutup detail penduduk"><Icon name="close" size={17}/></button><div className="npc-detail-heading"><span className="portrait portrait-large"><PixelSprite name={villagerFrame(npc, "down", 0)} size={62}/></span><div><h2>{npc.name}</h2><p>{ROLE_NAMES[npc.role]}</p></div></div><div className="npc-activity"><span className="live-dot"/><span>{activityText(npc)}</span></div>{npc.job && !npc.route.length && <Progress value={(1 - npc.job.remaining / npc.job.duration) * 100}/>}<div className="detail-facts"><span>Rumah<strong>Rumah {npc.home + 1}</strong></span><span>Pekerjaan selesai<strong>{npc.completed}</strong></span></div>{npc.cargo && <div className="panel-note"><Icon name={STOCK_ICONS[npc.cargo.resource]} size={16}/>Membawa {npc.cargo.amount} {RESOURCE_NAMES[npc.cargo.resource].toLowerCase()}</div>}<button className={`primary-button ${snapshot.followNpc ? "is-following" : ""}`} aria-pressed={snapshot.followNpc} onClick={() => controller.followNpc(!snapshot.followNpc)}><Icon name="focus" size={17}/>{snapshot.followNpc ? `Sedang mengikuti ${npc.name}` : `Ikuti ${npc.name}`}</button></aside>;
  if (!place) return null;
  const site = BUILD_SITES.find(b => b.id === place);
  const stage = wheatStage(state);
  const details: Record<string, { title: string; description: string; frame: string }> = {
    barn: { title: "Lumbung desa", description: "Persinggahan hasil panen sebelum dibawa ke pasar atau diolah menjadi sesuatu yang baru.", frame: "barn" },
    market: { title: "Pasar desa", description: "Elsie melayani pembeli dan menjual kiriman warga. Setiap penjualan membantu desa tumbuh.", frame: "market" },
    wheat: { title: "Ladang gandum", description: "Mara dan teman-temannya merawat, memanen, lalu menyiapkan tanaman berikutnya.", frame: "wheat-3" },
    "orchard-info": { title: "Kebun apel", description: "Lily dan Hazel merawat pohon sepanjang musim hangat. Apel dipetik saat musim gugur.", frame: `apple-${calendar(state).season}-0` },
  };
  const detail = details[place] ?? (site ? { title: site.name, description: site.description, frame: site.kind === "cottage" ? "house-1" : site.kind === "orchard" ? "orchard-shed" : site.kind } : { title: "Rumah penduduk", description: "Tempat pulang setelah satu hari penuh kegiatan. Jendela mulai bercahaya menjelang malam.", frame: "house-0" });
  return <aside ref={ref} className="selection-card" tabIndex={-1} aria-label={detail.title}><button className="icon-button card-close" onClick={onClose} aria-label="Tutup detail bangunan"><Icon name="close" size={17}/></button><div className="place-preview"><PixelSprite name={detail.frame} size={84}/></div><h2>{detail.title}</h2><p className="body-copy">{detail.description}</p>
    {place === "wheat" && <><div className="build-progress-label"><span>{stage < 0 ? "Ladang beristirahat" : stage === 3 ? "Siap panen" : stage === 0 && state.stats.harvestedWheat > 0 ? "Baru dipanen" : "Gandum tumbuh"}</span>{stage >= 0 && <strong>{Math.floor(state.wheatGrowth * 100)}%</strong>}</div>{stage >= 0 && <Progress value={state.wheatGrowth * 100}/>}<p className="quiet-note">{state.fieldStock.wheat} gandum menunggu diangkut.</p></>}
    {place === "orchard-info" && <div className="panel-note"><Icon name="leaf" size={16}/>{calendar(state).season === "autumn" ? `${state.fieldStock.apples} apel menunggu diangkut` : `Sekarang ${SEASON_NAMES[calendar(state).season].toLowerCase()}`}</div>}
    {place === "barn" && <div className="compact-stock">{(["wheat", "apples", "wood"] as Resource[]).map(r => <span key={r}><Icon name={STOCK_ICONS[r]} size={18}/>{state.inventory[r]}</span>)}</div>}
    {place === "market" && <div className="detail-facts"><span>Barang siap dijual<strong>{Object.values(state.marketStock).reduce((a, b) => a + b, 0)}</strong></span><span>Hasil perdagangan<strong>{state.stats.earned} koin</strong></span></div>}
    {site && !project && <><div className="build-price detail-price"><Icon name="coin"/>{site.coins} koin<Icon name="wood"/>{site.wood} kayu</div><button className="primary-button" disabled={!!buildReason(state, site.id)} onClick={() => onBuild(site.id)}><Icon name="build" size={17}/>Bangun di sini</button>{buildReason(state, site.id) && <p className="build-reason">{buildReason(state, site.id)}</p>}</>}
    {project && !project.complete && <><div className="build-progress-label"><span>Progres pembangunan</span><strong>{Math.round((1 - project.remaining / site!.seconds) * 100)}%</strong></div><Progress value={(1 - project.remaining / site!.seconds) * 100}/></>}
    {project?.complete && <div className="panel-note"><Icon name="check" size={16}/>{project.kind === "mill" ? `${state.millInput} gandum siap digiling, ${state.millOutput} tepung siap diangkut` : project.kind === "bakery" ? `${state.bakeryInput} tepung di dapur, ${state.bakeryOutput} roti siap diangkut` : "Sudah menjadi bagian dari Applebrook"}</div>}
    {project?.complete && (place === "mill" || place === "bakery") && <ShipmentControls state={state} controller={controller} routes={[place === "mill" ? "wheat-to-mill" : "flour-to-bakery"]}/>}
  </aside>;
}
