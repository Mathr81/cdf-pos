import { io, type Socket } from "socket.io-client";
import type {
  AppEvent,
  ClientToServerEvents,
  PullResponse,
  ServerToClientEvents,
  StoredEvent,
  SyncAck,
} from "@cdf/shared";
import { db, getMeta, setMeta } from "./db.js";
import { getDeviceId } from "./device.js";
import { useSession } from "./session.js";
import { applyIncoming, useStore } from "./store.js";

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

const CURSOR_KEY = "cursor";
const EPOCH_KEY = "epoch";

async function refreshPending() {
  useStore.getState().setPending(await db.outbox.count());
}

/**
 * Efface toutes les données locales de l'appareil (journal, outbox, curseur).
 * Utilisé après une remise à zéro serveur, ou manuellement depuis l'admin
 * quand un poste est dans un état incohérent.
 *
 * ⚠️ Les ventes encore en attente de synchro (outbox) sont perdues : c'est
 * voulu après un reset, mais à éviter si un poste est resté hors ligne.
 */
export async function wipeLocalData(): Promise<void> {
  await db.transaction("rw", db.log, db.outbox, db.meta, async () => {
    await db.log.clear();
    await db.outbox.clear();
    await db.meta.clear();
  });
}

/**
 * Compare l'epoch du serveur à celui mémorisé localement.
 * Retourne `false` si l'appareil a dû être purgé (un rechargement est lancé,
 * l'appelant doit s'arrêter là).
 */
async function ensureSameEpoch(): Promise<boolean> {
  if (!socket) return false;
  const hello = await socket
    .timeout(10000)
    .emitWithAck("sync:hello")
    .catch(() => null);
  const epoch = hello?.epoch;
  if (!epoch) return true; // serveur injoignable ou plus ancien : on continue

  const local = await getMeta(EPOCH_KEY);
  if (local === epoch) return true;
  if (local === null) {
    await setMeta(EPOCH_KEY, epoch);
    return true;
  }

  // Remise à zéro détectée : on repart d'une ardoise vierge.
  await wipeLocalData();
  await setMeta(EPOCH_KEY, epoch);
  window.location.reload();
  return false;
}

/** Reconstruit la projection depuis le journal local (démarrage hors-ligne). */
export async function hydrateFromLog(): Promise<void> {
  const rows = await db.log.toArray();
  // Rejeu en ordre causal : un order_void doit suivre sa vente. On trie par
  // seq serveur si connu, sinon par horodatage client (createdAt).
  rows.sort((a, b) => {
    if (a.seq != null && b.seq != null) return a.seq - b.seq;
    return a.event.createdAt.localeCompare(b.event.createdAt);
  });
  applyIncoming(rows.map((r) => r.event));
  await refreshPending();
}

/** Persiste des événements reçus dans le journal local + avance le curseur. */
async function persistIncoming(events: StoredEvent[]): Promise<void> {
  if (events.length === 0) return;
  await db.log.bulkPut(events.map((e) => ({ id: e.id, seq: e.seq, event: e })));
  const maxSeq = events.reduce((m, e) => Math.max(m, e.seq), 0);
  const current = Number((await getMeta(CURSOR_KEY)) ?? "0");
  if (maxSeq > current) await setMeta(CURSOR_KEY, String(maxSeq));
}

/** Rattrapage complet depuis le curseur courant (pagination). */
async function pull(): Promise<void> {
  if (!socket) return;
  let cursor = await getMeta(CURSOR_KEY);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res: PullResponse = await socket
      .timeout(15000)
      .emitWithAck("events:pull", cursor)
      .catch(() => ({ events: [], cursor, hasMore: false }) as PullResponse);
    if (res.events.length > 0) {
      applyIncoming(res.events);
      await persistIncoming(res.events);
    }
    cursor = res.cursor;
    if (!res.hasMore) break;
  }
}

/** Pousse l'outbox vers le serveur et purge les événements acquittés. */
export async function pushOutbox(): Promise<void> {
  if (!socket || !socket.connected) return;
  const rows = await db.outbox.orderBy("createdAt").toArray();
  if (rows.length === 0) return;
  const events = rows.map((r) => r.event);
  const ack: SyncAck = await socket
    .timeout(15000)
    .emitWithAck("events:push", events)
    .catch(() => ({ acceptedIds: [], rejected: [] }) as SyncAck);
  if (ack.acceptedIds.length > 0) {
    await db.outbox.bulkDelete(ack.acceptedIds);
  }
  await refreshPending();
}

/**
 * Enregistre localement un nouvel événement (optimiste) puis tente de le pousser.
 * Fonctionne hors-ligne : l'événement reste dans l'outbox jusqu'à reconnexion.
 */
export async function dispatch(event: AppEvent): Promise<void> {
  applyIncoming([event]); // application optimiste immédiate
  await db.outbox.put({ id: event.id, event, createdAt: Date.now() });
  await db.log.put({ id: event.id, seq: null, event });
  await refreshPending();
  void pushOutbox();
}

/** Établit la connexion temps réel et lance la synchro. */
export function connect(): void {
  const { accessCode, role, label } = useSession.getState();
  if (!accessCode || !role) return;
  if (socket) {
    socket.connect();
    return;
  }

  socket = io({
    path: "/socket.io",
    auth: { accessCode, role, deviceId: getDeviceId(), label: label ?? undefined },
    reconnection: true,
    reconnectionDelayMax: 5000,
  });

  socket.on("connect", async () => {
    useStore.getState().setConnected(true);
    // Toujours vérifier l'epoch AVANT de synchroniser : sinon on re-téléchargerait
    // par-dessus un journal local que l'on s'apprête à jeter.
    if (!(await ensureSameEpoch())) return;
    await pull();
    await pushOutbox();
  });

  socket.on("disconnect", () => useStore.getState().setConnected(false));

  socket.on("events:broadcast", (events) => {
    applyIncoming(events);
    void persistIncoming(events);
  });

  // Remise à zéro déclenchée depuis l'admin pendant que le poste est ouvert.
  socket.on("server:reset", ({ epoch }) => {
    void (async () => {
      await wipeLocalData();
      if (epoch) await setMeta(EPOCH_KEY, epoch);
      window.location.reload();
    })();
  });
}

export function disconnect(): void {
  socket?.disconnect();
  socket = null;
  useStore.getState().setConnected(false);
}
