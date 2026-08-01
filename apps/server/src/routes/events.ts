import type { FastifyInstance } from "fastify";
import type { StoredEvent } from "@cdf/shared";
import { prisma } from "../db.js";
import { ingestEvents } from "../ingest.js";
import { requireAccess } from "./guards.js";

const PAGE = 500;

export async function eventsRoutes(app: FastifyInstance) {
  /**
   * Rattrapage HTTP (fallback au pull Socket.IO) : renvoie les événements
   * après un curseur `seq`. Utile pour l'hydratation initiale du client.
   */
  app.get<{ Querystring: { after?: string } }>(
    "/events",
    { preHandler: requireAccess },
    async (req) => {
      const after = req.query.after ? Number(req.query.after) : 0;
      const rows = await prisma.event.findMany({
        where: { seq: { gt: Number.isFinite(after) ? after : 0 } },
        orderBy: { seq: "asc" },
        take: PAGE,
      });
      const events: StoredEvent[] = rows.map((r) => ({
        id: r.id,
        seq: r.seq,
        type: r.type,
        payload: r.payload,
        deviceId: r.deviceId,
        clientSeq: r.clientSeq,
        createdAt: r.createdAt.toISOString(),
        serverReceivedAt: r.serverReceivedAt.toISOString(),
      })) as StoredEvent[];
      return {
        events,
        cursor: events.length ? String(events[events.length - 1].seq) : String(after),
        hasMore: rows.length === PAGE,
      };
    },
  );

  /**
   * Ingestion HTTP (fallback au push Socket.IO). Applique + diffuse.
   */
  app.post<{ Body: { events?: unknown[] } }>(
    "/events",
    { preHandler: requireAccess },
    async (req) => {
      const events = Array.isArray(req.body?.events) ? req.body!.events : [];
      return ingestEvents(app.io, events);
    },
  );
}
