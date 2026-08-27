import { Server } from "socket.io";
import type { Server as HttpServer } from "node:http";
import {
  type AppEvent,
  type ClientToServerEvents,
  type HandshakeAuth,
  type PullResponse,
  type ServerToClientEvents,
  type StoredEvent,
  ROLES,
} from "@cdf/shared";
import { env } from "./env.js";
import { prisma } from "./db.js";
import { ingestEvents } from "./ingest.js";
import { PresenceRegistry } from "./presence.js";
import { getEpoch } from "./reset.js";

const PULL_PAGE_SIZE = 500;

/** Convertit une ligne Event (Prisma) en StoredEvent typé. */
function toStoredEvent(row: {
  id: string;
  seq: number;
  type: string;
  payload: unknown;
  deviceId: string;
  clientSeq: number;
  createdAt: Date;
  serverReceivedAt: Date;
}): StoredEvent {
  return {
    id: row.id,
    seq: row.seq,
    type: row.type,
    payload: row.payload,
    deviceId: row.deviceId,
    clientSeq: row.clientSeq,
    createdAt: row.createdAt.toISOString(),
    serverReceivedAt: row.serverReceivedAt.toISOString(),
  } as StoredEvent;
}

export function createSocketServer(httpServer: HttpServer) {
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: env.corsOrigin, credentials: true },
    // Le buffer d'événements manqués est géré par notre propre pull(seq),
    // pas par la reconnexion Socket.IO.
    transports: ["websocket", "polling"],
  });

  // --- Authentification par code d'accès partagé (handshake) ---
  io.use((socket, next) => {
    const auth = socket.handshake.auth as Partial<HandshakeAuth>;
    if (auth?.accessCode !== env.appAccessCode) {
      return next(new Error("unauthorized"));
    }
    if (!auth.role || !ROLES.includes(auth.role)) {
      return next(new Error("invalid role"));
    }
    if (!auth.deviceId) {
      return next(new Error("missing deviceId"));
    }
    next();
  });

  const presence = new PresenceRegistry();
  let lastBroadcast = "";

  /**
   * Rediffuse la liste des postes — mais seulement si elle a changé.
   * Sans ce garde-fou, chaque vente encaissée sur chaque caisse déclencherait
   * un message vers tous les appareils (pending 0 → 1 → 0), pour rien.
   */
  const broadcastPresence = () => {
    const entries = presence.list();
    const snapshot = JSON.stringify(entries);
    if (snapshot === lastBroadcast) return;
    lastBroadcast = snapshot;
    io.emit("presence:update", entries);
  };

  io.on("connection", (socket) => {
    const auth = socket.handshake.auth as Partial<HandshakeAuth>;
    presence.join(socket.id, {
      deviceId: auth.deviceId!,
      role: auth.role!,
      label: auth.label,
    });
    // Le nouvel arrivant reçoit l'état courant même si rien n'a changé pour
    // les autres : sans ça, un admin qui ouvre l'app verrait une liste vide.
    socket.emit("presence:update", presence.list());
    broadcastPresence();

    socket.on("presence:pending", (count: number) => {
      presence.setPending(socket.id, count);
      broadcastPresence();
    });
    // Epoch de la session de données : le client compare avec le sien avant de
    // se synchroniser, et purge son journal local s'il a changé (remise à zéro).
    socket.on("sync:hello", async (ack) => {
      try {
        ack?.({ epoch: await getEpoch() });
      } catch {
        ack?.({ epoch: "" });
      }
    });

    // Poussée d'un batch d'événements (outbox client).
    socket.on("events:push", async (events: AppEvent[], ack) => {
      try {
        const result = await ingestEvents(io, events ?? []);
        ack?.(result);
      } catch (e) {
        ack?.({ acceptedIds: [], rejected: [{ id: "batch", error: (e as Error).message }] });
      }
    });

    // Rattrapage depuis un curseur (seq). cursor = "42" | null.
    socket.on("events:pull", async (cursor: string | null, ack) => {
      try {
        const afterSeq = cursor ? Number(cursor) : 0;
        const rows = await prisma.event.findMany({
          where: { seq: { gt: Number.isFinite(afterSeq) ? afterSeq : 0 } },
          orderBy: { seq: "asc" },
          take: PULL_PAGE_SIZE,
        });
        const events = rows.map(toStoredEvent);
        const response: PullResponse = {
          events,
          cursor: events.length ? String(events[events.length - 1].seq) : cursor,
          hasMore: rows.length === PULL_PAGE_SIZE,
        };
        ack?.(response);
      } catch (e) {
        ack?.({ events: [], cursor, hasMore: false });
      }
    });

    socket.on("disconnect", () => {
      presence.leave(socket.id);
      broadcastPresence();
    });
  });

  return io;
}
