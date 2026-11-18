import type { Role, Villager } from "./types.ts";

export const DISTINCT_ROLES = ["baker", "hauler", "carpenter"] as const;
const distinctRoles = new Set<Role>(DISTINCT_ROLES);

export function villagerFrame(npc: Pick<Villager, "role" | "color">, facing: Villager["facing"], step: number) {
  const costume = distinctRoles.has(npc.role) ? `${npc.role}-` : "";
  return `npc-${costume}${npc.color}-${facing}-${step}`;
}
