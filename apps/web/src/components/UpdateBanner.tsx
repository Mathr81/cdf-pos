import { useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { ArrowsClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowsClockwise";

import { useStore } from "../lib/store.js";

/** Une tablette reste ouverte toute la soirée sans jamais naviguer : sans
    vérification périodique, elle ne découvrirait jamais une mise à jour. */
const CHECK_EVERY_MS = 5 * 60_000;
let checkTimer: ReturnType<typeof setInterval> | undefined;

/**
 * Nouvelle version disponible.
 *
 * Le service worker est en mode « prompt » : la nouvelle version attend
 * qu'on la lance, plutôt que de recharger la page d'office — en plein
 * encaissement, ce serait perdre le panier. Le bouton fait l'équivalent
 * d'un Ctrl+F5 : la nouvelle version prend la main, puis la page recharge.
 * Le journal et les ventes en attente sont dans IndexedDB, pas dans le
 * cache : un rechargement n'y touche pas.
 */
export function UpdateBanner() {
  const pending = useStore((s) => s.pending);
  const [busy, setBusy] = useState(false);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // Module-level : un retour à l'écran de connexion remonte ce composant.
      clearInterval(checkTimer);
      checkTimer = setInterval(() => {
        // Hors ligne, la vérification échoue : on retentera au tour suivant.
        registration.update().catch(() => {});
      }, CHECK_EVERY_MS);
    },
  });

  // Ventes non transmises : le rechargement est sans danger pour elles, mais
  // l'avertissement « quitter la page ? » de Layout s'afficherait. On attend
  // que tout soit envoyé.
  if (!needRefresh || pending > 0) return null;

  const reload = () => {
    setBusy(true);
    void updateServiceWorker(true);
    // Filet : si la nouvelle version ne prend pas la main, on recharge quand même.
    setTimeout(() => window.location.reload(), 3000);
  };

  return (
    <div className="flex shrink-0 items-center justify-center gap-3 bg-dusk px-3 py-1.5 text-micro font-bold text-night print:hidden">
      <span className="min-w-0 md:flex-none">Nouvelle version de l'app — recharge entre deux clients</span>
      <button
        onClick={reload}
        disabled={busy}
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-control bg-night px-3 text-cream disabled:opacity-60"
      >
        <ArrowsClockwiseIcon size={16} weight="bold" className={busy ? "animate-spin" : undefined} />
        Recharger
      </button>
    </div>
  );
}
