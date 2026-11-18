"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type Phaser from "phaser";
import { VillageController } from "@/game/controller";
import type { OfflineReport, Speed, VillageState } from "@/game/types";
import { Ambience } from "@/game/ambience";
import { buildReason, calendar, festivalGoals, openingGoalSite, outingGoodsText, REGIONAL_ACTIVITIES, shipmentCarrier } from "@/game/simulation";
import { BUILD_SITES, LANDMARKS, SEASON_NAMES, STATIONS, pointAt } from "@/game/world";
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

function openingStatus(state: VillageState, id: string) {
  const project = state.projects.find(item => item.id === id);
  if (!project) return buildReason(state, id) ?? "Pilih lokasi untuk mulai membangun.";
  if (!project.complete) {
    const worker = state.villagers.find(npc => npc.job?.projectId === id && !npc.route.length);
    if (worker) return `${worker.name} sedang membangun.`;
    return "Menunggu tukang tiba di lokasi.";
  }
  const baker = state.villagers.find(npc => npc.job?.kind === "bake" && !npc.route.length);
  if (baker) return `${baker.name} sedang memanggang.`;
  if (state.bakeryInput >= 2) return "Tepung sudah tiba di dapur.";
  const carrier = shipmentCarrier(state, "flour-to-bakery");
  if (carrier) return `${carrier.name} sedang mengantar tepung.`;
  if (state.millOutput >= 2) return "Tepung siap diangkut dari Penggilingan.";
  if (state.millInput >= 4) return "Gandum siap digiling menjadi tepung.";
  return "Penggilingan menunggu kiriman gandum.";
}

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
        {report.outings > 0 && <p>{report.outings} kegiatan di luar desa selesai.</p>}
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
  const [timeOptionsOpen, setTimeOptionsOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [sound, setSound] = useState(false);
  const ambience = useRef<Ambience | null>(null);
  const lastSpeed = useRef<Speed>(state.speed || 1);
  const lastVillage = useRef(state);
  const goalButton = useRef<HTMLButtonElement>(null);
  const mapToggle = useRef<HTMLButtonElement>(null);
  const timeToggle = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const showPanel = useCallback((next: Panel) => {
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && focused.matches("button") && !focused.closest("aside")) {
      returnFocus.current = focused.closest(".time-extra") && timeToggle.current?.getClientRects().length ? timeToggle.current : focused;
    }
    controller.selectPlace(null);
    setTimeOptionsOpen(false);
    setPanel(current => current === next ? null : next);
  }, [controller]);

  const restoreFocus = useCallback(() => {
    const target = returnFocus.current;
    (target?.isConnected && target.getClientRects().length ? target : goalButton.current)?.focus();
    returnFocus.current = null;
  }, []);

  const closeAll = useCallback(() => {
    setPanel(null);
    setMapOpen(false);
    setTimeOptionsOpen(false);
    controller.selectPlace(null);
    restoreFocus();
  }, [controller, restoreFocus]);

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
    const previous = lastVillage.current;
    lastVillage.current = state;
    if (snapshot.offline) return;
    if (previous.stats.breadBaked === 0 && state.stats.breadBaked > 0) {
      setToast("Roti pertama Applebrook sudah matang!");
      ambience.current?.playMilestone("bread");
      return;
    }
    const finished = state.projects.find(project => project.complete && !previous.projects.some(old => old.id === project.id && old.complete));
    if (finished) {
      setToast(BUILD_SITES.find(site => site.id === finished.id)!.name + " selesai!");
      ambience.current?.playMilestone("build");
    } else if (previous.priorityShipment && !state.priorityShipment) {
      const carrier = shipmentCarrier(previous, previous.priorityShipment);
      if (carrier && !state.villagers.find(npc => npc.id === carrier.id)?.cargo) setToast("Kiriman yang didahulukan sudah tiba.");
    } else {
      const returns = LANDMARKS.flatMap(site => {
        const outing = state.outings[site.id];
        if (outing?.phase !== "done" || previous.outings[site.id]?.phase !== "returning") return [];
        return [outingGoodsText(REGIONAL_ACTIVITIES[site.id].reward, outing.amount)];
      });
      if (returns.length) setToast("Warga membawa pulang " + returns.join(", ") + ".");
    }
  }, [snapshot.offline, state]);

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
        case "+": case "=": controller.camera({ type: "zoom", delta: 0.15 }); break;
        case "-": controller.camera({ type: "zoom", delta: -0.15 }); break;
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
    controller.camera({ type: "pan", ...pointAt(site), revealPanel: true });
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
  const nextSite = openingGoalSite(state);
  const baking = nextSite?.id === "bakery" && state.projects.some(project => project.id === "bakery" && project.complete);
  const step = nextSite?.id === "mill" ? 1 : baking ? 3 : 2;
  const festivalProgress = festivalGoals(state).filter(Boolean).length;
  const festivalHeld = state.stats.festivalYear === date.year;

  function focusGoal() {
    if (!nextSite) { showPanel("festival"); return; }
    returnFocus.current = goalButton.current;
    setPanel(null);
    controller.selectPlace(nextSite.id);
    controller.camera({ type: "pan", ...pointAt(nextSite), revealPanel: true });
  }

  return (
    <>
      <div className="game-overlay">
        <div className="village-title">
          <PixelSprite name="apple-spring-0" size={42}/>
          <h1>Applebrook</h1>
        </div>

        <button ref={goalButton} className="village-goal" onClick={focusGoal}>
          <PixelSprite name={nextSite ? baking ? "cargo-bread" : `plot-${nextSite.kind}` : "tool-flag"} size={48}/>
          <span className="goal-copy">
            {nextSite && <small>Langkah {step} dari 3</small>}
            <strong>{nextSite ? baking ? "Panggang roti pertama" : `Bangun ${nextSite.name}` : festivalHeld ? "Festival sudah dirayakan" : "Siapkan Festival Panen"}</strong>
            <span className="goal-status">{nextSite ? openingStatus(state, nextSite.id) : festivalHeld ? "Lihat hasil perayaan tahun ini." : `${festivalProgress} dari 4 persiapan selesai`}</span>
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

        {panel && <VillagePanel panel={panel} snapshot={snapshot} controller={controller} onClose={closeAll} onBuild={build}/>}
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
          {mapOpen && <MiniMap state={state} controller={controller} onVisit={id => {
            returnFocus.current = mapToggle.current;
            setMapOpen(false);
            setPanel(null);
            controller.selectPlace(id);
          }}/>}
          <div className="control-tray">
            <button ref={mapToggle} aria-label="Peta desa" aria-expanded={mapOpen} onClick={() => setMapOpen(open => !open)}><Icon name="map" size={17}/></button>
            <button aria-label="Pusatkan kamera" onClick={() => controller.camera({ type: "home" })}><Icon name="focus" size={17}/></button>
            <button aria-label="Perkecil peta" onClick={() => controller.camera({ type: "zoom", delta: -0.15 })}><Icon name="minus" size={17}/></button>
            <button aria-label="Perbesar peta" onClick={() => controller.camera({ type: "zoom", delta: 0.15 })}><Icon name="plus" size={17}/></button>
          </div>
        </div>

        <div className="time-dock control-tray">
          <button aria-label={state.speed ? "Jeda permainan" : "Lanjutkan permainan"} aria-pressed={!state.speed} onClick={togglePause}><Icon name={state.speed ? "pause" : "play"} size={15}/></button>
          <button ref={timeToggle} className="time-options-toggle" aria-label="Pengaturan waktu dan suara" aria-controls="time-options" aria-expanded={timeOptionsOpen}
            onClick={() => setTimeOptionsOpen(open => !open)}>
            {state.speed || lastSpeed.current}×
          </button>
          <div className="time-extra" id="time-options">
            <button aria-label="Panduan bermain" onClick={() => showPanel("guide")}><Icon name="help" size={17}/></button>
            <button aria-label={sound ? "Matikan suara permainan" : "Aktifkan suara permainan"} aria-pressed={sound} onClick={toggleSound}><Icon name={sound ? "sound" : "mute"} size={16}/></button>
            {SPEEDS.map(speed => <button key={speed} aria-pressed={state.speed === speed} aria-label={"Kecepatan " + speed + " kali"} onClick={() => {
              controller.setSpeed(speed);
              if (timeOptionsOpen) timeToggle.current?.focus();
              setTimeOptionsOpen(false);
            }}>{speed}×</button>)}
          </div>
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
        const [{ createGame }] = await Promise.all([
          import("@/game/create-game"),
          document.fonts.load("600 16px Pixelify"),
          document.fonts.load("700 14px Atkinson"),
        ]);
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
