import type { PresenceEntry, Role } from "@cdf/shared";

/**
 * Qui est connecté, et combien de ventes chacun retient.
 * ─────────────────────────────────────────────────────────────
 * Le handshake reçoit déjà `deviceId`, `role` et `label` ; ce registre se
 * contente de s'en souvenir. Il existe pour une raison précise : avant une
 * remise à zéro, l'admin doit voir qu'une tablette est hors ligne avec des
 * ventes non transmises. Le README le demandait déjà, rien ne permettait de
 * le vérifier.
 *
 * Volontairement en mémoire : la présence n'a de sens qu'à l'instant présent.
 * Un redémarrage du serveur la vide, et les tablettes se réannoncent en se
 * reconnectant.
 */

export interface JoinInfo {
  deviceId: string;
  role: Role;
  label?: string;
}

interface Connection extends JoinInfo {
  connectedAt: string;
  pending: number;
}

export class PresenceRegistry {
  /** Une entrée par SOCKET : un appareil peut en avoir deux le temps d'une reconnexion. */
  private readonly bySocket = new Map<string, Connection>();

  join(socketId: string, info: JoinInfo): void {
    this.bySocket.set(socketId, {
      ...info,
      connectedAt: new Date().toISOString(),
      pending: 0,
    });
  }

  leave(socketId: string): void {
    this.bySocket.delete(socketId);
  }

  setPending(socketId: string, count: number): void {
    const conn = this.bySocket.get(socketId);
    if (!conn) return;
    conn.pending = Math.max(0, Math.trunc(count));
  }

  /**
   * Un poste par appareil, trié par libellé.
   *
   * Le dédoublonnage n'est pas cosmétique : pendant une reconnexion, deux
   * sockets coexistent et l'admin verrait « Caisse 1 » en double. On retient
   * la connexion la plus récente, mais le PLUS GRAND nombre de ventes en
   * attente — un socket mourant qui annonce 0 ne doit pas effacer les 4 que
   * l'autre vient de signaler.
   */
  list(): PresenceEntry[] {
    const byDevice = new Map<string, PresenceEntry>();

    for (const conn of this.bySocket.values()) {
      const existing = byDevice.get(conn.deviceId);
      if (!existing) {
        byDevice.set(conn.deviceId, { ...conn });
        continue;
      }
      existing.pending = Math.max(existing.pending, conn.pending);
      if (conn.connectedAt > existing.connectedAt) {
        existing.connectedAt = conn.connectedAt;
        existing.label = conn.label;
        existing.role = conn.role;
      }
    }

    return [...byDevice.values()].sort((a, b) =>
      (a.label ?? a.deviceId).localeCompare(b.label ?? b.deviceId),
    );
  }

  /** Ventes retenues par l'ensemble des postes actuellement joignables. */
  totalPending(): number {
    return this.list().reduce((sum, e) => sum + e.pending, 0);
  }
}
