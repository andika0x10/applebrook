import type { LandmarkId } from "./world.ts";

export type Season = "spring" | "summer" | "autumn" | "winter";
export type Resource = "wheat" | "apples" | "flour" | "bread" | "wood";
export type Inventory = Record<Resource, number>;
export type Priority = "balanced" | "stockpile" | "trade";
export type ShipmentRoute = "wheat-to-mill" | "flour-to-bakery";
export type Speed = 0 | 1 | 2 | 4;
export type BuildingKind = "mill" | "bakery" | "cottage" | "orchard";
export type Role = "farmer" | "gardener" | "hauler" | "merchant" | "driver" | "carpenter" | "miller" | "baker";
export type JobKind = "plant" | "harvest" | "tend" | "pick" | "collect" | "deliver" | "mill" | "bake" | "sell" | "build" | "wood" | "rest" | "sleep" | "festival" | "outing";
export interface Point { x: number; y: number }
export interface Tile { col: number; row: number }
export type Station = "wheat" | "orchard" | "barn" | "market" | "mill" | "bakery" | "forest" | "home" | "plaza";
export interface Cargo { resource: Resource; amount: number; destination: Station }
export interface Job {
  kind: JobKind; station: Station; duration: number; remaining: number;
  resource?: Resource; source?: "field" | "barn" | "mill" | "bakery";
  destination?: Station; projectId?: string;
}
export interface Villager {
  id: number; name: string; role: Role; color: number; home: number;
  x: number; y: number; facing: "left" | "right" | "up" | "down";
  route: Point[]; job: Job | null; cargo: Cargo | null; completed: number;
}
export interface Project { id: string; kind: BuildingKind; col: number; row: number; remaining: number; complete: boolean }
export interface JournalEntry { id: number; day: number; text: string; kind: "village" | "trade" | "build" | "season" }
export type Outing = { phase: "supplies" | "outbound" | "returning" } | { phase: "done"; day: number; amount: number };
export interface VillageState {
  version: 1; elapsed: number; coins: number; inventory: Inventory;
  fieldStock: { wheat: number; apples: number }; marketStock: Inventory;
  millInput: number; millOutput: number; bakeryInput: number; bakeryOutput: number;
  wheatGrowth: number; appleGrowth: number; priority: Priority; speed: Speed;
  priorityShipment: ShipmentRoute | null;
  outings: Partial<Record<LandmarkId, Outing>>;
  villagers: Villager[]; projects: Project[]; journal: JournalEntry[];
  stats: { earned: number; harvestedWheat: number; harvestedApples: number; breadBaked: number; festivalYear: number };
  nextEventId: number;
}
export interface OfflineReport { seconds: number; coins: number; wheat: number; apples: number; bread: number; buildings: number; outings: number }
export interface Snapshot {
  state: VillageState; saved: "saved" | "memory" | "saving";
  selectedNpc: number | null; selectedPlace: string | null; followNpc: boolean; offline: OfflineReport | null;
}
