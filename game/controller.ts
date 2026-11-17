import type { Priority, Snapshot, Speed, VillageState } from "./types.ts";
import { advanceVillage, startBuilding } from "./simulation.ts";
import { applyOffline, loadVillage, SAVE_KEY } from "./persistence.ts";

export type CameraCommand = { type: "zoom"; delta: number } | { type: "home" } | { type: "pan"; x: number; y: number };
export class VillageController {
  state: VillageState;
  private listeners = new Set<() => void>();
  private cameraListeners = new Set<(command: CameraCommand) => void>();
  private snapshot: Snapshot;
  private storage: Storage | null;
  private publishTimer = 0;
  private saveTimer = 0;
  private hiddenAt: number | null = null;
  constructor(storage: Storage | null) {
    this.storage = storage;
    const loaded = loadVillage(storage);
    this.state = loaded.state;
    this.snapshot = { state: structuredClone(this.state), saved: storage ? "saved" : "memory", selectedNpc: null, selectedPlace: null, followNpc: false, offline: loaded.offline };
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;
  private publish = () => {
    this.snapshot = { ...this.snapshot, state: structuredClone(this.state) };
    for (const listener of this.listeners) listener();
  };
  tick(seconds: number) {
    if (this.hiddenAt !== null) return;
    advanceVillage(this.state, Math.min(seconds, 0.15) * this.state.speed);
    this.publishTimer += seconds; this.saveTimer += seconds;
    if (this.publishTimer >= 0.4) { this.publishTimer = 0; this.publish(); }
    if (this.saveTimer >= 8) { this.saveTimer = 0; this.save(); }
  }
  setSpeed(speed: Speed) { this.state.speed = speed; this.publish(); this.save(); }
  setPriority(priority: Priority) { this.state.priority = priority; this.publish(); this.save(); }
  build(id: string) { const result = startBuilding(this.state, id); this.publish(); this.save(); return result; }
  selectNpc(id: number | null) { this.snapshot = { ...this.snapshot, selectedNpc: id, selectedPlace: null, followNpc: false }; this.publish(); }
  selectPlace(id: string | null) { this.snapshot = { ...this.snapshot, selectedPlace: id, selectedNpc: null, followNpc: false }; this.publish(); }
  followNpc(follow: boolean) { this.snapshot = { ...this.snapshot, followNpc: follow }; this.publish(); }
  dismissOffline() { this.snapshot = { ...this.snapshot, offline: null }; this.publish(); this.save(); }
  camera(command: CameraCommand) { for (const listener of this.cameraListeners) listener(command); }
  onCamera(listener: (command: CameraCommand) => void) { this.cameraListeners.add(listener); return () => { this.cameraListeners.delete(listener); }; }
  save() {
    let status: Snapshot["saved"] = "saved";
    try {
      if (!this.storage) throw new Error("Storage unavailable");
      this.storage.setItem(SAVE_KEY, JSON.stringify({ version: 1, savedAt: Date.now(), state: this.state }));
    } catch { status = "memory"; }
    if (this.snapshot.saved !== status) { this.snapshot = { ...this.snapshot, saved: status }; this.publish(); }
  }
  visibility(hidden: boolean) {
    if (hidden && this.hiddenAt === null) { this.save(); this.hiddenAt = Date.now(); }
    else if (!hidden && this.hiddenAt !== null) {
      const report = applyOffline(this.state, this.hiddenAt); this.hiddenAt = null;
      if (report) this.snapshot = { ...this.snapshot, offline: report };
      this.publish(); this.save();
    }
  }
  destroy() { this.save(); this.listeners.clear(); this.cameraListeners.clear(); }
}
