import type { Server } from "socket.io";
import {
  EventSchema,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type StoredEvent,
  type SyncAck,
} from "@cdf/shared";
import { applyEvent } from "./projections.js";
import { enqueueBackup } from "./backup/index.js";

export type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;

/**
 * Point d'entrée unique pour intégrer des événements (depuis le socket OU le REST).
 * Valide, applique de façon idempotente, met en file de sauvegarde, puis diffuse
 * en temps réel les événements réellement nouveaux à tous les clients connectés.
 */
export async function ingestEvents(io: IoServer, rawEvents: unknown[]): Promise<SyncAck> {
  const acceptedIds: string[] = [];
  const rejected: { id: string; error: string }[] = [];
  const broadcast: StoredEvent[] = [];

  for (const raw of rawEvents) {
    const parsed = EventSchema.safeParse(raw);
    if (!parsed.success) {
      const id = (raw as { id?: string })?.id ?? "unknown";
      rejected.push({ id, error: parsed.error.issues.map((i) => i.message).join("; ") });
      continue;
    }
    try {
      const res = await applyEvent(parsed.data);
      // Doublon connu OU nouvellement appliqué → dans les deux cas l'événement
      // est durablement stocké : on l'acquitte pour que le client vide son outbox.
      acceptedIds.push(parsed.data.id);
      if (res.applied && res.stored) {
        broadcast.push(res.stored);
        await enqueueBackup(res.stored).catch(() => {
          /* la file de backup ne doit jamais bloquer l'ingestion */
        });
      }
    } catch (e) {
      rejected.push({ id: parsed.data.id, error: (e as Error).message });
    }
  }

  if (broadcast.length > 0) {
    io.emit("events:broadcast", broadcast);
  }

  return { acceptedIds, rejected };
}
