import { create } from "zustand";
import {
  emptyProjection,
  reduceEvent,
  type AppEvent,
  type ProjectionState,
  type StoredEvent,
} from "@cdf/shared";

/**
 * Projection locale (singleton muté en place) + état UI réactif minimal.
 * Les composants s'abonnent à `rev` (incrémenté à chaque changement) et lisent
 * la projection via les sélecteurs de @cdf/shared.
 */
export const projection: ProjectionState = emptyProjection();

const appliedIds = new Set<string>();

interface UiState {
  /** Compteur de révision : bumpé à chaque mutation de la projection. */
  rev: number;
  connected: boolean;
  /** Nombre d'événements en attente de synchro (outbox). */
  pending: number;
  bump: () => void;
  setConnected: (v: boolean) => void;
  setPending: (n: number) => void;
}

export const useStore = create<UiState>((set) => ({
  rev: 0,
  connected: false,
  pending: 0,
  bump: () => set((s) => ({ rev: s.rev + 1 })),
  setConnected: (connected) => set({ connected }),
  setPending: (pending) => set({ pending }),
}));

/**
 * Applique un lot d'événements (locaux ou reçus) à la projection, en
 * dédupliquant par `id`. Renvoie le seq serveur max rencontré (ou null).
 */
export function applyIncoming(events: (AppEvent | StoredEvent)[]): number | null {
  let changed = false;
  let maxSeq: number | null = null;
  for (const ev of events) {
    if ("seq" in ev && typeof ev.seq === "number") {
      maxSeq = maxSeq === null ? ev.seq : Math.max(maxSeq, ev.seq);
    }
    if (appliedIds.has(ev.id)) continue;
    appliedIds.add(ev.id);
    reduceEvent(projection, ev);
    changed = true;
  }
  if (changed) useStore.getState().bump();
  return maxSeq;
}

export function hasApplied(id: string): boolean {
  return appliedIds.has(id);
}
