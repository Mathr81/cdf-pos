import { DevicesIcon } from "@phosphor-icons/react/dist/csr/Devices";
import { WarningIcon } from "@phosphor-icons/react/dist/csr/Warning";
import { WifiSlashIcon } from "@phosphor-icons/react/dist/csr/WifiSlash";
import type { PresenceEntry } from "@cdf/shared";
import { useStore } from "../../lib/store.js";
import { Card } from "../../components/ui.js";
import { cn } from "../../lib/cn.js";

/**
 * Postes connectés, et ce qu'ils retiennent.
 * ─────────────────────────────────────────────────────────────
 * Placé juste au-dessus des boutons de remise à zéro, parce que c'est le
 * moment où l'information compte : le README demandait déjà de « vérifier que
 * tous les postes sont En ligne d'abord », sans donner le moyen de le faire.
 *
 * Ce panneau ne dit PAS qui est hors ligne — le serveur ne connaît que les
 * connexions ouvertes. Une tablette éteinte avec des ventes dedans est
 * simplement absente de la liste, d'où l'avertissement permanent.
 */

const ROLE_LABELS: Record<string, string> = {
  caisse: "Caisse",
  cuisine: "Cuisine",
  admin: "Admin",
  stats: "Stats",
};

function depuis(iso: string): string {
  const minutes = Math.floor((Date.now() - Date.parse(iso)) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `depuis ${minutes} min`;
  return `depuis ${Math.floor(minutes / 60)} h`;
}

function Ligne({ entry }: { entry: PresenceEntry }) {
  const enAttente = entry.pending > 0;
  return (
    <div className="flex items-center gap-3 border-t border-line py-2.5">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-mint" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="truncate text-body font-bold text-cream">
          {entry.label ?? entry.deviceId.slice(0, 8)}
        </div>
        <div className="text-micro text-ash">
          {ROLE_LABELS[entry.role] ?? entry.role} · {depuis(entry.connectedAt)}
        </div>
      </div>
      {/* Le nombre en attente n'apparaît que s'il est non nul : une colonne de
          « 0 » sur six postes n'apprend rien et noie le seul qui compte. */}
      {enAttente && (
        <span className="tnum inline-flex shrink-0 items-center gap-1 rounded-full bg-signal px-2.5 py-1 text-micro font-bold text-night">
          <WarningIcon size={13} weight="fill" />
          {entry.pending} en attente
        </span>
      )}
    </div>
  );
}

export function PresencePanel() {
  const presence = useStore((s) => s.presence);
  const connected = useStore((s) => s.connected);

  const totalPending = presence.reduce((sum, e) => sum + e.pending, 0);

  return (
    <Card className={cn("p-4", totalPending > 0 && "border-signal/70")}>
      <h2 className="font-display flex items-center gap-2 text-lead font-bold text-cream">
        <DevicesIcon size={20} weight="fill" className="text-sand" />
        Postes connectés
        <span className="tnum ml-auto text-body font-bold text-sand">{presence.length}</span>
      </h2>

      {!connected ? (
        <p className="mt-2 flex items-center gap-2 text-body text-signal">
          <WifiSlashIcon size={17} weight="bold" />
          Ce poste est hors ligne — impossible de savoir qui est connecté.
        </p>
      ) : presence.length === 0 ? (
        <p className="mt-2 text-body text-sand">Aucun poste connecté.</p>
      ) : (
        <div className="mt-2">
          {presence.map((e) => (
            <Ligne key={e.deviceId} entry={e} />
          ))}
        </div>
      )}

      {totalPending > 0 && (
        <p className="mt-3 rounded-control border border-signal bg-signal/10 p-3 text-body font-semibold text-signal">
          {totalPending} vente(s) pas encore arrivée(s) au serveur. Attends qu'elles se
          synchronisent avant d'effacer quoi que ce soit.
        </p>
      )}

      {connected && (
        <p className="mt-3 text-micro text-ash">
          Seuls les postes actuellement connectés apparaissent. Une tablette éteinte ou hors réseau
          peut détenir des ventes sans figurer ici — d'où l'écran de sauvegarde qui bloque toute
          purge destructrice.
        </p>
      )}
    </Card>
  );
}
