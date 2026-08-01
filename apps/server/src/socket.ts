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

  io.on("connection", (socket) => {
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
  });

  return io;
}
