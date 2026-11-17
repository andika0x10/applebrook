"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type Phaser from "phaser";
import { VillageController } from "@/game/controller";
import type { OfflineReport, Speed } from "@/game/types";
import { Ambience } from "@/game/ambience";
import { calendar, festivalGoals, hasBuilding } from "@/game/simulation";
import { BUILD_SITES, SEASON_NAMES, pointAt } from "@/game/world";
import Icon from "./Icons";
import PixelSprite from "./PixelSprite";
import MiniMap from "./MiniMap";
import { SelectionCard, VillagePanel, totalStock, type Panel } from "./Panels";

const TOOLS: { id: Panel; label: string; sprite: string; shortcut?: string }[] = [
  { id: "build", label: "Bangun", sprite: "tool-hammer", shortcut: "B" },
  { id: "stock", label: "Lumbung", sprite: "barn" },
  { id: "villagers", label: "Warga", sprite: "npc-1-down-0", shortcut: "N" },
  { id: "priority", label: "Prioritas", sprite: "sign" },
  { id: "festival", label: "Festival", sprite: "tool-flag" },
  { id: "journal", label: "Catatan", sprite: "tool-book" },
];
const SPEEDS: Speed[] = [1, 2, 4];

function OfflineModal({ report, onClose }: { report: OfflineReport; onClose: () => void }) {
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    button.current?.focus();
    return () => previous?.focus();
  }, []);

  return (
    <div className="modal-backdrop">
      <section className="offline-modal" role="dialog" aria-modal="true" aria-labelledby="offline-title"
        onKeyDown={event => {
          if (event.key === "Escape") onClose();
          if (event.key === "Tab") event.preventDefault();
        }}>
        <PixelSprite name="barn" size={88}/>
        <h2 id="offline-title">Hasil selama kamu pergi</h2>
        <div className="offline-results">
          <span><PixelSprite name="hud-coin" size={24}/><strong>+{report.coins}</strong><small>Koin pasar</small></span>
          <span><PixelSprite name="wheat-3" size={24}/><strong>{report.wheat}</strong><small>Gandum dipanen</small></span>
          <span><PixelSprite name="cargo-apples" size={24}/><strong>{report.apples}</strong><small>Apel dipetik</small></span>
        </div>
        {report.bread > 0 && <p>{report.bread} roti dipanggang.</p>}
        {report.buildings > 0 && <p>{report.buildings} bangunan selesai.</p>}
        <p className="offline-limit">Waktu desa bertambah {Math.max(1, Math.round(report.seconds / 60))} menit.</p>
        <button ref={button} className="primary-button" onClick={onClose}>Kembali ke desa</button>
      </section>
    </div>
  );
}

function GameInterface({ controller }: { controller: VillageController }) {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const { state } = snapshot;
  const date = calendar(state);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [sound, setSound] = useState(false);
  const ambience = useRef<Ambience | null>(null);
  const lastSpeed = useRef<Speed>(state.speed || 1);
  const showPanel = useCallback((next: Panel) => {
    controller.selectPlace(null);
    setPanel(current => current === next ? null : next);
  }, [controller]);

  const closeAll = useCallback(() => {
    setPanel(null);
    setMapOpen(false);
    controller.selectPlace(null);
  }, [controller]);

  const togglePause = useCallback(() => {
    const speed = controller.state.speed;
    if (speed) lastSpeed.current = speed;
    controller.setSpeed(speed ? 0 : lastSpeed.current);
  }, [controller]);

  useEffect(() => {
    if (snapshot.selectedNpc !== null || snapshot.selectedPlace !== null) setPanel(null);
  }, [snapshot.selectedNpc, snapshot.selectedPlace]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 4200);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => () => ambience.current?.stop(), []);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (snapshot.offline || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "Escape") { closeAll(); return; }
      if ((event.target as HTMLElement | null)?.closest("button, input, select, textarea, [contenteditable], [role=button]")) return;
      switch (event.key.toLowerCase()) {
        case " ": event.preventDefault(); togglePause(); break;
        case "h": controller.camera({ type: "home" }); break;
        case "b": showPanel("build"); break;
        case "n": showPanel("villagers"); break;
        case "m": setMapOpen(open => !open); break;
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [controller, snapshot.offline, showPanel, closeAll, togglePause]);

  function build(id: string) {
    const site = BUILD_SITES.find(site => site.id === id);
    if (!site) return;
    const reason = controller.build(id);
    if (reason) { setToast(reason); return; }
    setPanel(null);
    controller.selectPlace(id);
    controller.camera({ type: "pan", ...pointAt(site) });
    setToast(site.name + " masuk daftar pembangunan.");
  }

  async function toggleSound() {
    if (sound) { ambience.current?.stop(); setSound(false); return; }
    try {
      ambience.current ??= new Ambience();
      await ambience.current.start();
      setSound(true);
    } catch {
      setToast("Suara alam tidak bisa diputar.");
    }
  }

  const hasSelection = snapshot.selectedNpc !== null || snapshot.selectedPlace !== null;
  const nextBuilding = hasBuilding(state, "mill") ? "bakery" : "mill";
  const nextSite = BUILD_SITES.find(site => site.id === nextBuilding)!;
  const project = state.projects.find(project => project.id === nextBuilding);
  const festivalProgress = festivalGoals(state).filter(Boolean).length;
  const showFestival = project?.complete || festivalProgress === 4;

  function focusGoal() {
    if (showFestival) { showPanel("festival"); return; }
    setPanel(null);
    controller.selectPlace(nextBuilding);
    controller.camera({ type: "pan", ...pointAt(nextSite) });
  }

  return (
    <>
      <div className="game-overlay">
        <div className="village-title">
          <PixelSprite name="apple-spring-0" size={42}/>
          <h1>Applebrook</h1>
        </div>

        <button className="village-goal" onClick={focusGoal}>
          <PixelSprite name={showFestival ? "tool-flag" : nextBuilding} size={32}/>
          <span>
            <small>{showFestival ? "Festival panen" : project ? "Sedang dibangun" : "Bangunan berikutnya"}</small>
            <strong>{showFestival ? festivalProgress + "/4 persiapan selesai" : nextSite.name}</strong>
          </span>
          <Icon name="chevron" size={14}/>
        </button>

        <div className="village-ledger">
          <div className="village-date">
            <Icon name={date.night ? "moon" : date.season === "winter" ? "snow" : "sun"} size={21}/>
            <span>{SEASON_NAMES[date.season]} · Hari {date.day}<small>Tahun {date.year}</small></span>
            <time>{String(date.hour).padStart(2, "0") + ":" + String(date.minute).padStart(2, "0")}</time>
          </div>
          <button className="village-stock" onClick={() => showPanel("stock")} aria-label="Persediaan desa">
            <span title="Koin"><PixelSprite name="hud-coin" size={18}/>{state.coins.toLocaleString("id-ID")}</span>
            <span title="Gandum"><PixelSprite name="wheat-3" size={18}/>{totalStock(state, "wheat")}</span>
            <span title="Apel"><PixelSprite name="cargo-apples" size={18}/>{totalStock(state, "apples")}</span>
            <span title="Kayu"><PixelSprite name="cargo-wood" size={18}/>{state.inventory.wood}</span>
          </button>
        </div>

        {panel && <VillagePanel panel={panel} snapshot={snapshot} controller={controller} onClose={() => setPanel(null)} onBuild={build}/>}
        {!panel && hasSelection && <SelectionCard snapshot={snapshot} controller={controller} onClose={closeAll} onBuild={build}/>}

        <nav className="village-hotbar" aria-label="Kelola desa">
          {TOOLS.map(tool => (
            <button key={tool.id} onClick={() => showPanel(tool.id)} aria-pressed={panel === tool.id}>
              {tool.shortcut && <kbd>{tool.shortcut}</kbd>}
              <PixelSprite name={tool.sprite} size={32}/>
              <span>{tool.label}</span>
            </button>
          ))}
        </nav>

        <div className="camera-dock">
          {mapOpen && <MiniMap state={state} controller={controller}/>}
          <div className="control-tray">
            <button aria-label="Peta desa" aria-expanded={mapOpen} onClick={() => setMapOpen(open => !open)}><Icon name="map" size={17}/></button>
            <button aria-label="Pusatkan kamera" onClick={() => controller.camera({ type: "home" })}><Icon name="focus" size={17}/></button>
            <button aria-label="Perkecil peta" onClick={() => controller.camera({ type: "zoom", delta: -0.15 })}><Icon name="minus" size={17}/></button>
            <button aria-label="Perbesar peta" onClick={() => controller.camera({ type: "zoom", delta: 0.15 })}><Icon name="plus" size={17}/></button>
          </div>
        </div>

        <div className="time-dock control-tray">
          <button aria-label="Panduan bermain" onClick={() => showPanel("guide")}><Icon name="help" size={17}/></button>
          <button aria-label={sound ? "Matikan suara alam" : "Aktifkan suara alam"} aria-pressed={sound} onClick={toggleSound}><Icon name={sound ? "sound" : "mute"} size={16}/></button>
          <button aria-label={state.speed ? "Jeda permainan" : "Lanjutkan permainan"} aria-pressed={!state.speed} onClick={togglePause}><Icon name={state.speed ? "pause" : "play"} size={15}/></button>
          {SPEEDS.map(speed => <button key={speed} aria-pressed={state.speed === speed} aria-label={"Kecepatan " + speed + " kali"} onClick={() => controller.setSpeed(speed)}>{speed}×</button>)}
        </div>

        {(toast || snapshot.saved === "memory") && <div className="toast" role="status">{toast || "Penyimpanan browser tidak tersedia."}</div>}
      </div>
      {snapshot.offline && <OfflineModal report={snapshot.offline} onClose={() => controller.dismissOffline()}/>}
    </>
  );
}

export default function Applebrook() {
  const host = useRef<HTMLDivElement>(null);
  const [controller, setController] = useState<VillageController | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let game: Phaser.Game | null = null;
    let storage: Storage | null = null;
    try { storage = window.localStorage; } catch { /* Browser may block storage. */ }

    const village = new VillageController(storage);
    setController(village);
    setReady(false);
    setFailed(false);
    const visibility = () => village.visibility(document.hidden);
    const save = () => village.save();
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", save);

    void (async () => {
      try {
        const [{ createGame }] = await Promise.all([import("@/game/create-game"), document.fonts.load("600 16px Pixelify")]);
        if (cancelled || !host.current) return;
        game = createGame(host.current, village, () => { if (!cancelled) setReady(true); }, () => { if (!cancelled) setFailed(true); });
      } catch (error) {
        console.error("Applebrook could not start:", error);
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", save);
      game?.destroy(true);
      village.destroy();
    };
  }, [attempt]);

  return (
    <main className="applebrook-app">
      <div className="phaser-world" ref={host} role="application"
        aria-label="Peta desa Applebrook. Gunakan tombol panah untuk menggeser kamera." tabIndex={0}/>
      {ready && controller && <GameInterface controller={controller}/>}
      {!ready && <div className="loading-screen">
        <PixelSprite name="apple-spring-0" size={76}/>
        <h1>Applebrook</h1>
        <p>{failed ? "Peta gagal dimuat." : "Memuat desa…"}</p>
        {failed && <button className="primary-button" onClick={() => setAttempt(value => value + 1)}>Coba lagi</button>}
      </div>}
    </main>
  );
}
