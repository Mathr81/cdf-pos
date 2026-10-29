import { create } from "zustand";
import type { ConflictRow } from "./db.js";
import {
  emptyProjection,
  reduceEvent,
  retractOrder,
  type AppEvent,
  type PresenceEntry,
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

/**
 * Purge suspendue faute d'avoir pu sauver les ventes en attente.
 *  - `manual` : l'utilisateur a demandé la purge depuis Admin
 *  - `reset`  : remise à zéro diffusée par un AUTRE poste
 *  - `epoch`  : reconnexion sur une base serveur déjà réinitialisée
 */
export interface BlockedWipe {
  reason: "manual" | "reset" | "epoch";
  count: number;
}

interface UiState {
  /** Compteur de révision : bumpé à chaque mutation de la projection. */
  rev: number;
  connected: boolean;
  /** Nombre d'événements en attente de synchro (outbox). */
  pending: number;
  /** Non nul quand une purge est retenue : l'UI passe en mode bloquant. */
  blocked: BlockedWipe | null;
  /** Postes connectés, tels que le serveur les voit. Vide si hors ligne. */
  presence: PresenceEntry[];
  /** Commandes encaissées ici et pas encore acquittées (badge « ⏳ »). */
  pendingOrderIds: ReadonlySet<string>;
  /** Encaissements refusés par le serveur, en attente d'une décision. */
  conflicts: ConflictRow[];
  bump: () => void;
  setConnected: (v: boolean) => void;
  setPending: (n: number) => void;
  setBlocked: (b: BlockedWipe | null) => void;
  setPresence: (p: PresenceEntry[]) => void;
  setOutboxState: (s: { pendingOrderIds: ReadonlySet<string>; conflicts: ConflictRow[] }) => void;
}

export const useStore = create<UiState>((set) => ({
  rev: 0,
  connected: false,
  pending: 0,
  blocked: null,
  presence: [],
  pendingOrderIds: new Set(),
  conflicts: [],
  bump: () => set((s) => ({ rev: s.rev + 1 })),
  setConnected: (connected) => set({ connected }),
  setPending: (pending) => set({ pending }),
  setBlocked: (blocked) => set({ blocked }),
  setPresence: (presence) => set({ presence }),
  setOutboxState: (s) => set(s),
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

/** Retire des commandes refusées par le serveur de la projection locale. */
export function retractOrders(orderIds: string[]): void {
  if (orderIds.length === 0) return;
  for (const id of orderIds) retractOrder(projection, id);
  useStore.getState().bump();
}

export function hasApplied(id: string): boolean {
  return appliedIds.has(id);
}
