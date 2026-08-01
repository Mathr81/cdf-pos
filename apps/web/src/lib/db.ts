import Dexie, { type EntityTable } from "dexie";
import type { AppEvent } from "@cdf/shared";

/**
 * Base locale IndexedDB (Dexie).
 *  - `outbox` : événements créés localement, pas encore acquittés par le serveur.
 *  - `log`    : tous les événements connus (locaux + reçus), pour reconstruire
 *               la projection au démarrage sans re-télécharger tout le flux.
 *  - `meta`   : paires clé/valeur (curseur de synchro, etc.).
 */

export interface OutboxRow {
  id: string; // = event.id
  event: AppEvent;
  createdAt: number;
}

export interface LogRow {
  id: string; // = event.id
  seq: number | null; // seq serveur (null tant que non confirmé)
  event: AppEvent;
}

export interface MetaRow {
  key: string;
  value: string;
}

export const db = new Dexie("cdf-pos") as Dexie & {
  outbox: EntityTable<OutboxRow, "id">;
  log: EntityTable<LogRow, "id">;
  meta: EntityTable<MetaRow, "key">;
};

db.version(1).stores({
  outbox: "id, createdAt",
  log: "id, seq",
  meta: "key",
});

export async function getMeta(key: string): Promise<string | null> {
  const row = await db.meta.get(key);
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  await db.meta.put({ key, value });
}
