import type { AppEvent, StoredEvent } from "./events.js";

/**
 * Contrat temps réel Socket.IO entre le client et le serveur.
 * Les noms de canaux sont centralisés ici pour éviter les fautes de frappe.
 */

/** Postes possibles pour une connexion. */
export const ROLES = ["caisse", "cuisine", "admin", "stats"] as const;
export type Role = (typeof ROLES)[number];

/** Accusé de réception d'un batch d'événements poussé par le client. */
export interface SyncAck {
  acceptedIds: string[];
  rejected: { id: string; error: string }[];
}

/** Réponse à une demande de rattrapage (pull) depuis un curseur. */
export interface PullResponse {
  events: StoredEvent[];
  /** Nouveau curseur (serverReceivedAt du dernier événement). */
  cursor: string | null;
  /** true s'il reste des événements au-delà (pagination). */
  hasMore: boolean;
}

/**
 * Salutation du serveur : identifie la « session de données » courante.
 * Si l'epoch a changé depuis la dernière connexion, c'est qu'une remise à zéro
 * a eu lieu → le client doit purger son journal local plutôt que le rejouer.
 */
export interface ServerHello {
  epoch: string;
}

/**
 * Poste connecté, tel que l'admin le voit.
 *
 * `pending` est déclaré par le poste lui-même : le serveur ne peut pas le
 * deviner, ces événements n'existent que dans l'IndexedDB de la tablette.
 * C'est précisément ce qui rend l'information utile avant une remise à zéro.
 */
export interface PresenceEntry {
  deviceId: string;
  role: Role;
  label?: string;
  /** Connexion de CE socket (ISO). Repart à zéro à chaque reconnexion. */
  connectedAt: string;
  /** Ventes créées sur ce poste et pas encore acquittées par le serveur. */
  pending: number;
}

/** Événements émis par le CLIENT vers le SERVEUR. */
export interface ClientToServerEvents {
  /** Demande l'epoch serveur avant toute synchro. */
  "sync:hello": (ack: (res: ServerHello) => void) => void;
  /** Pousser un batch d'événements locaux (outbox). Callback = accusé. */
  "events:push": (events: AppEvent[], ack: (res: SyncAck) => void) => void;
  /** Rattraper les événements manqués depuis un curseur. */
  "events:pull": (cursor: string | null, ack: (res: PullResponse) => void) => void;
  /** Déclare le nombre de ventes en attente sur ce poste. */
  "presence:pending": (count: number) => void;
}

/** Événements émis par le SERVEUR vers le CLIENT. */
export interface ServerToClientEvents {
  /** Diffusion d'un ou plusieurs événements nouvellement acceptés. */
  "events:broadcast": (events: StoredEvent[]) => void;
  /** Une remise à zéro vient d'avoir lieu : les clients doivent se purger. */
  "server:reset": (hello: ServerHello) => void;
  /** Liste des postes connectés, rediffusée à chaque changement. */
  "presence:update": (entries: PresenceEntry[]) => void;
}

/** Données attachées à une connexion (handshake auth). */
export interface HandshakeAuth {
  accessCode: string;
  role: Role;
  deviceId: string;
  label?: string;
}
