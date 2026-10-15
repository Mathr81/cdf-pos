import type { Server } from "socket.io";
import {
  EventSchema,
  type ClientToServerEvents,
  type EventType,
  type ServerToClientEvents,
  type StoredEvent,
  type SyncAck,
} from "@cdf/shared";
import { applyEvent } from "./projections.js";
import { enqueueBackup } from "./backup/index.js";

export type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;

/**
 * Seuls types qu'un poste SANS PIN admin peut émettre : vendre (caisse),
 * ajuster le stock (onglet Stock de la caisse), marquer préparé (cuisine).
 *
 * Tout le reste — annuler ou modifier une vente, toucher la carte, les
 * soirées, la caisse — est réservé à l'admin. Le vérifier dans l'interface
 * ne suffit pas : le code d'accès est partagé par tous les bénévoles, et
 * une annulation après coup est la fraude classique sur une caisse.
 */
const PUBLIC_TYPES: ReadonlySet<EventType> = new Set(["sale", "stock_adjust", "prepared"]);

/**
 * Une seule ingestion à la fois.
 *
 * Le `seq` est attribué à l'insertion mais visible au commit. Deux batchs
 * concurrents pourraient donc publier 21 avant 20 : un poste qui a vu 21
 * avance son curseur et ne redemandera jamais 20. En sérialisant, l'ordre
 * des `seq` est celui des commits et des diffusions. À l'échelle d'une salle
 * des fêtes, le débit perdu est nul.
 */
let queue: Promise<unknown> = Promise.resolve();

/**
 * Point d'entrée unique pour intégrer des événements.
 * Valide, applique de façon idempotente, met en file de sauvegarde, puis diffuse
 * en temps réel les événements réellement nouveaux à tous les clients connectés.
 */
export function ingestEvents(
  io: IoServer,
  rawEvents: unknown[],
  opts: { isAdmin: boolean },
): Promise<SyncAck> {
  const run = queue.then(() => ingestNow(io, rawEvents, opts));
  queue = run.catch(() => undefined);
  return run;
}

async function ingestNow(
  io: IoServer,
  rawEvents: unknown[],
  { isAdmin }: { isAdmin: boolean },
): Promise<SyncAck> {
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
    if (!isAdmin && !PUBLIC_TYPES.has(parsed.data.type)) {
      rejected.push({ id: parsed.data.id, error: "PIN administrateur requis" });
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
