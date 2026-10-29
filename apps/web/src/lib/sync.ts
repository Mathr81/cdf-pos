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
import { describeDevice } from "./deviceInfo.js";
import { pendingCount, wipeLocalData } from "./localData.js";
import { useSession } from "./session.js";
import { applyIncoming, retractOrders, useStore } from "./store.js";

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

const CURSOR_KEY = "cursor";
/**
 * Événements par message. Socket.IO coupe la connexion au-delà d'1 Mo : une
 * tablette restée longtemps hors ligne enverrait sinon toute son outbox d'un
 * bloc, se ferait déconnecter, et recommencerait en boucle.
 */
const PUSH_CHUNK = 200;
const EPOCH_KEY = "epoch";

async function refreshPending() {
  const rows = await db.outbox.toArray();
  const count = rows.length;
  useStore.getState().setPending(count);
  useStore.getState().setOutboxState({
    pendingOrderIds: new Set(rows.flatMap((r) => (r.event.type === "sale" ? [r.event.payload.orderId] : []))),
    conflicts: await db.conflicts.orderBy("at").toArray(),
  });
  // Le serveur ne peut pas deviner ce chiffre : ces événements n'existent que
  // dans l'IndexedDB de cette tablette. C'est précisément ce qui le rend utile
  // à l'admin avant une remise à zéro.
  socket?.emit("presence:pending", count);
}

/**
 * Purge demandée par le serveur (reset diffusé, ou epoch divergent au
 * retour du réseau). Suspend la purge si des ventes n'ont jamais été
 * transmises : elles n'existent que sur cette tablette.
 *
 * On ne tente délibérément PAS de les pousser d'abord. Le serveur vient
 * d'être vidé : les réinjecter ferait réapparaître des ventes que l'admin
 * a explicitement effacées. C'est à l'écran bloquant de laisser choisir,
 * sauvegarde en main.
 *
 * Renvoie `false` si l'appelant doit s'arrêter (purge suspendue ou
 * rechargement en cours).
 */
async function wipeForServer(reason: "reset" | "epoch", epoch?: string | null): Promise<boolean> {
  const count = await pendingCount();
  if (count > 0) {
    useStore.getState().setBlocked({ reason, count });
    return false;
  }
  await wipeLocalData();
  if (epoch) await setMeta(EPOCH_KEY, epoch);
  window.location.reload();
  return false;
}

/** Pousse ce qui reste, puis renvoie le nombre de ventes encore en attente. */
export async function retryPendingSync(): Promise<number> {
  await pushOutbox();
  return pendingCount();
}

/** Purge acceptée en connaissance de cause, après sauvegarde du secours. */
export async function forceWipeAndReload(): Promise<void> {
  await wipeLocalData({ force: true });
  window.location.reload();
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
  return wipeForServer("epoch", epoch);
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
  for (let i = 0; i < rows.length; i += PUSH_CHUNK) {
    const events = rows.slice(i, i + PUSH_CHUNK).map((r) => r.event);
    const ack: SyncAck | null = await socket
      .timeout(15000)
      .emitWithAck("events:push", events)
      .catch(() => null);
    if (!ack) break; // réseau perdu : la suite repartira à la reconnexion
    if (ack.acceptedIds.length > 0) await db.outbox.bulkDelete(ack.acceptedIds);
    await settleConflicts(ack);
  }
  await refreshPending();
}

/**
 * Encaissements de réservation refusés : une autre caisse est passée avant.
 * Les renvoyer ne changerait rien, on les sort de l'outbox et du journal.
 * Si la caisse avait déjà annulé son encaissement (annulation encore en
 * attente), il n'y a rien à trancher : les deux partent. Sinon le conflit
 * est gardé jusqu'à ce que la caisse dise ce qu'elle a fait de l'argent.
 */
export async function settleConflicts(ack: SyncAck): Promise<void> {
  const ids = ack.rejected.filter((r) => r.code === "conflict").map((r) => r.id);
  if (ids.length === 0) return;
  const retracted: string[] = [];
  await db.transaction("rw", [db.outbox, db.log, db.conflicts], async () => {
    const outbox = await db.outbox.toArray();
    for (const id of ids) {
      const row = outbox.find((r) => r.id === id);
      if (row?.event.type !== "sale") continue;
      const sale = row.event;
      const voids = outbox.filter(
        (r) => r.event.type === "order_void" && r.event.payload.orderId === sale.payload.orderId,
      );
      const drop = [id, ...voids.map((r) => r.id)];
      await db.outbox.bulkDelete(drop);
      await db.log.bulkDelete(drop);
      // Arrivée d'une réservation payée d'avance : aucun argent en jeu,
      // l'autre caisse l'a déjà pointée, il n'y a rien à trancher.
      if (voids.length === 0 && sale.payload.paymentMethod !== "prepaid") {
        const error = ack.rejected.find((r) => r.id === id)?.error ?? "Déjà encaissée";
        await db.conflicts.put({ id, event: sale, error, at: Date.now() });
      }
      retracted.push(sale.payload.orderId);
    }
  });
  retractOrders(retracted);
}

/**
 * Enregistre localement un nouvel événement (optimiste) puis tente de le pousser.
 * Fonctionne hors-ligne : l'événement reste dans l'outbox jusqu'à reconnexion.
 */
export async function dispatch(event: AppEvent): Promise<void> {
  return dispatchMany([event]);
}

/**
 * Même chose pour un lot (import de réservations) : une seule écriture et
 * une seule poussée, au lieu d'une poussée concurrente par événement.
 */
export async function dispatchMany(events: AppEvent[]): Promise<void> {
  // Écrire AVANT d'afficher : si IndexedDB refuse (stockage plein, navigation
  // privée), l'appelant reçoit l'erreur et rien ne s'affiche. L'inverse
  // montrerait une vente « encaissée » qui disparaît au rechargement.
  const now = Date.now();
  await db.transaction("rw", db.outbox, db.log, async () => {
    await db.outbox.bulkPut(events.map((event) => ({ id: event.id, event, createdAt: now })));
    await db.log.bulkPut(events.map((event) => ({ id: event.id, seq: null, event })));
  });
  applyIncoming(events);
  await refreshPending();
  void pushOutbox();
}

/** Décision de la caisse sur un conflit : la ligne disparaît, l'éventuelle vente de remplacement est déjà émise. */
export async function dismissConflict(id: string): Promise<void> {
  await db.conflicts.delete(id);
  await refreshPending();
}

/** Établit la connexion temps réel et lance la synchro. */
export function connect(): void {
  const { accessCode, adminPin, role, label } = useSession.getState();
  if (!accessCode || !role) return;
  if (socket) {
    socket.connect();
    return;
  }

  socket = io({
    path: "/socket.io",
    // Fonction, relue à chaque (re)connexion : le modèle Android arrive après coup.
    auth: (cb) =>
      cb({
        accessCode,
        role,
        deviceId: getDeviceId(),
        label: label ?? undefined,
        device: describeDevice(),
        // Le serveur n'accepte les actions admin que d'un socket qui porte le PIN.
        adminPin: adminPin ?? undefined,
      }),
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

  // Code d'accès ou PIN changé côté serveur : sans ça, le poste resterait
  // « Hors ligne » pour toujours, comme une simple panne de wifi. On revient
  // à l'écran de connexion ; l'outbox, elle, est conservée et partira dès la
  // reconnexion avec le bon code.
  socket.on("connect_error", (err) => {
    if (err.message !== "unauthorized") return;
    disconnect();
    useSession.getState().reset();
  });

  socket.on("disconnect", () => {
    useStore.getState().setConnected(false);
    // Hors ligne, la liste des postes est une information périmée : on
    // préfère ne rien afficher plutôt qu'un état qui a pu changer depuis.
    useStore.getState().setPresence([]);
  });

  socket.on("presence:update", (entries) => useStore.getState().setPresence(entries));

  socket.on("events:broadcast", (events) => {
    applyIncoming(events);
    void persistIncoming(events);
  });

  // Remise à zéro déclenchée depuis l'admin pendant que le poste est ouvert.
  socket.on("server:reset", ({ epoch }) => {
    void wipeForServer("reset", epoch);
  });
}

export function disconnect(): void {
  socket?.disconnect();
  socket = null;
  useStore.getState().setConnected(false);
}
