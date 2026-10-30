import { isBookingSoiree } from "@cdf/shared";
import { ClipboardTextIcon } from "@phosphor-icons/react/dist/csr/ClipboardText";

import { projection } from "../../lib/store.js";
import { useActiveSoiree, useRev } from "../../lib/hooks.js";
import { useSession } from "../../lib/session.js";
import { useUrlState } from "../../lib/urlState.js";
import { cn } from "../../lib/cn.js";
import { EmptyState } from "../../components/ui.js";
import { NoSoiree } from "../../components/NoSoiree.js";
import { Toast, useToast } from "../../components/Toast.js";
import { TabBtn } from "../admin/TabBtn.js";
import { CheckinTab } from "./CheckinTab.js";
import { DashboardTab } from "./DashboardTab.js";
import { ManageTab } from "./ManageTab.js";
import { PrintList } from "./PrintList.js";

type Tab = "accueil" | "bord" | "gestion";

/**
 * Soirées sur réservation : remplace la liste imprimée que chaque caisse
 * surlignait. Un encaissement est une vente ordinaire (voir
 * `packages/shared/src/reservations.ts`) : il apparaît partout ailleurs —
 * stats, récap, comptage de caisse — sans traitement particulier.
 */
export function ReservationsScreen() {
  useRev();
  const soiree = useActiveSoiree();
  const isAdmin = useSession((s) => s.isAdmin);
  const [tab, setTab] = useUrlState<Tab>("vue", "accueil");
  const { toast, show, hide } = useToast();

  if (!soiree) return <NoSoiree />;
  const booking = isBookingSoiree(projection, soiree.id);
  if (!booking && !isAdmin) {
    return (
      <EmptyState
        icon={<ClipboardTextIcon size={48} weight="light" />}
        title="Cette soirée n'est pas sur réservation"
        hint="Un responsable peut fixer les tarifs dans l'onglet Réservations, avec le PIN."
      />
    );
  }
  // Sans tarifs, seule la gestion a un sens ; sans PIN, pas de gestion.
  const current: Tab = !booking ? "gestion" : tab === "gestion" && !isAdmin ? "accueil" : tab;

  return (
    <>
      {/* Accueil : plus large sur iPad en paysage, pour la colonne de droite. */}
      <div
        className={cn(
          "mx-auto flex h-full max-w-4xl flex-col p-4 print:hidden",
          current === "accueil" && "lg:max-w-6xl",
        )}
      >
        {/* Sur téléphone, les onglets prennent toute une ligne à parts égales au
            lieu de passer à la ligne n'importe où sous le titre. */}
        <div className="mb-3 flex shrink-0 flex-col gap-2 md:flex-row md:items-center">
          <h1 className="font-display text-title font-bold text-cream md:mr-auto">Réservations</h1>
          {booking && (
            <div className={cn("grid gap-2 md:flex", isAdmin ? "grid-cols-3" : "grid-cols-2")}>
              <TabBtn active={current === "accueil"} onClick={() => setTab("accueil")}>
                Accueil
              </TabBtn>
              <TabBtn active={current === "bord"} onClick={() => setTab("bord")}>
                Suivi
              </TabBtn>
              {isAdmin && (
                <TabBtn active={current === "gestion"} onClick={() => setTab("gestion")}>
                  Gestion
                </TabBtn>
              )}
            </div>
          )}
        </div>
        {current === "accueil" && <CheckinTab soireeId={soiree.id} toast={show} />}
        {current === "bord" && <DashboardTab soireeId={soiree.id} />}
        {current === "gestion" && <ManageTab soireeId={soiree.id} soireeName={soiree.name} toast={show} />}
        <Toast toast={toast} onHide={hide} />
      </div>
      {booking && <PrintList soireeId={soiree.id} />}
    </>
  );
}
