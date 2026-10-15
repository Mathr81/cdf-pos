import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import type { Icon } from "@phosphor-icons/react";
import { ReceiptIcon } from "@phosphor-icons/react/dist/csr/Receipt";
import { ChefHatIcon } from "@phosphor-icons/react/dist/csr/ChefHat";
import { PackageIcon } from "@phosphor-icons/react/dist/csr/Package";
import { NotebookIcon } from "@phosphor-icons/react/dist/csr/Notebook";
import { ChartBarIcon } from "@phosphor-icons/react/dist/csr/ChartBar";
import { ConfettiIcon } from "@phosphor-icons/react/dist/csr/Confetti";
import { GearIcon } from "@phosphor-icons/react/dist/csr/Gear";
import { SignOutIcon } from "@phosphor-icons/react/dist/csr/SignOut";
import { StorefrontIcon } from "@phosphor-icons/react/dist/csr/Storefront";
import { WifiHighIcon } from "@phosphor-icons/react/dist/csr/WifiHigh";
import { WifiSlashIcon } from "@phosphor-icons/react/dist/csr/WifiSlash";
import { CloudArrowUpIcon } from "@phosphor-icons/react/dist/csr/CloudArrowUp";
import { CloudWarningIcon } from "@phosphor-icons/react/dist/csr/CloudWarning";
import { GraduationCapIcon } from "@phosphor-icons/react/dist/csr/GraduationCap";
import { QuestionIcon } from "@phosphor-icons/react/dist/csr/Question";

import { useSession } from "../lib/session.js";
import { useActiveSoiree } from "../lib/hooks.js";
import { useStore } from "../lib/store.js";
import { disconnect } from "../lib/sync.js";
import { getDeviceId } from "../lib/device.js";
import { useWakeLock } from "../lib/wakeLock.js";
import { cn } from "../lib/cn.js";
import { PendingSalesGuard } from "./PendingSalesGuard.js";

interface NavItem {
  to: string;
  label: string;
  icon: Icon;
}

/* Routes et libellés strictement inchangés : l'équipe est formée dessus.
   Seule l'icône passe d'un emoji à un glyphe cohérent. */
function navItemsFor(role: string | null, isAdmin: boolean): NavItem[] {
  const caisse = { to: "/caisse", label: "Caisse", icon: ReceiptIcon };
  const cuisine = { to: "/cuisine", label: "Cuisine", icon: ChefHatIcon };
  const inventaire = { to: "/inventaire", label: "Stock", icon: PackageIcon };
  const journal = { to: "/journal", label: "Journal", icon: NotebookIcon };
  const stats = { to: "/stats", label: "Stats", icon: ChartBarIcon };
  const soirees = { to: "/soirees", label: "Soirées", icon: ConfettiIcon };
  const admin = { to: "/admin", label: "Admin", icon: GearIcon };
  // L'aide est présente pour TOUS les postes, y compris cuisine qui n'a
  // qu'un seul autre onglet : c'est justement le poste tenu par les
  // bénévoles les moins habitués à l'app.
  const aide = { to: "/aide", label: "Aide", icon: QuestionIcon };
  if (isAdmin) return [caisse, cuisine, inventaire, journal, stats, soirees, admin, aide];
  switch (role) {
    case "cuisine":
      return [cuisine, aide];
    case "stats":
      return [stats, aide];
    // Même ordre que pour un poste avec PIN : deux tablettes admin ne doivent
    // pas présenter les onglets dans deux ordres différents.
    case "admin":
      return [caisse, cuisine, inventaire, journal, stats, soirees, admin, aide];
    default:
      return [caisse, inventaire, aide];
  }
}

type SyncState = "online" | "syncing" | "stalled" | "offline";

/**
 * Trois états visibles au lieu de deux, en lecture seule sur le store
 * existant (`connected` + `pending`) : `lib/sync.ts` n'est pas touché.
 *
 * « Sync bloquée » se déduit du fait que l'outbox ne se vide plus alors
 * que le socket est connecté. C'est le cas qui, jusqu'ici, ressemblait
 * exactement à un fonctionnement normal.
 */
function useSyncState(): { state: SyncState; pending: number } {
  const connected = useStore((s) => s.connected);
  const pending = useStore((s) => s.pending);
  const [stalled, setStalled] = useState(false);
  const lastChange = useRef({ pending, at: Date.now() });

  useEffect(() => {
    if (lastChange.current.pending !== pending) {
      lastChange.current = { pending, at: Date.now() };
      setStalled(false);
    }
  }, [pending]);

  useEffect(() => {
    if (!connected || pending === 0) {
      setStalled(false);
      return;
    }
    const id = setInterval(() => {
      if (Date.now() - lastChange.current.at > 20_000) setStalled(true);
    }, 5_000);
    return () => clearInterval(id);
  }, [connected, pending]);

  if (!connected) return { state: "offline", pending };
  if (pending === 0) return { state: "online", pending };
  return { state: stalled ? "stalled" : "syncing", pending };
}

function SyncIndicator() {
  const { state, pending } = useSyncState();

  const config = {
    online: { Icon: WifiHighIcon, text: "En ligne", tone: "text-mint" },
    syncing: { Icon: CloudArrowUpIcon, text: `Envoi de ${pending}…`, tone: "text-lantern" },
    stalled: { Icon: CloudWarningIcon, text: `${pending} bloqués`, tone: "text-signal" },
    offline: {
      Icon: WifiSlashIcon,
      text: pending > 0 ? `Hors ligne · ${pending} en attente` : "Hors ligne",
      tone: "text-signal",
    },
  }[state];

  return (
    /* Jamais tronqué : c'est un état critique (C4). Sur téléphone, c'est la
       nav qui défile, pas cet indicateur qui se réduit à « En… ». */
    <div className={cn("flex items-center gap-1.5 text-micro font-semibold", config.tone)}>
      <config.Icon size={15} weight="bold" className="shrink-0" />
      <span className="whitespace-nowrap">{config.text}</span>
    </div>
  );
}

/**
 * Avertit avant de quitter avec des ventes non transmises.
 * Bonus, pas protection : iOS ne déclenche pas `beforeunload` de façon
 * fiable quand on balaye l'app. Le vrai rempart est la garde de
 * `wipeLocalData` — celui-ci ne couvre que desktop et Android.
 */
function usePendingExitWarning() {
  const pending = useStore((s) => s.pending);
  useEffect(() => {
    if (pending === 0) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [pending]);
}

/**
 * Bandeau permanent en soirée d'entraînement.
 *
 * Non refermable, et c'est délibéré : le danger n'est pas d'oublier qu'on
 * s'entraîne, c'est d'encaisser un vrai client sur une soirée d'exercice et
 * de ne jamais retrouver l'argent dans les comptes.
 */
function TrainingBanner() {
  const soiree = useActiveSoiree();
  if (!soiree?.training) return null;
  return (
    <div className="flex shrink-0 items-center justify-center gap-2 bg-lantern px-3 print:hidden py-1.5 text-center text-micro font-bold text-night">
      <GraduationCapIcon size={16} weight="fill" className="shrink-0" />
      MODE ENTRAÎNEMENT · « {soiree.name} » — ces ventes ne comptent pas dans les chiffres
    </div>
  );
}

/**
 * Deux tablettes sous le même nom de caisse : la clôture regroupe par nom,
 * elle fusionnerait donc deux boîtes en une seule ligne (un fond, un
 * comptage) et l'écart ne voudrait plus rien dire. « Caisse 1 » étant le
 * choix par défaut, il suffit que deux bénévoles ne touchent à rien.
 */
function DuplicateRegisterBanner() {
  const { role, label } = useSession();
  const presence = useStore((s) => s.presence);
  if (role !== "caisse" || !label) return null;
  const me = getDeviceId();
  const twin = presence.some((p) => p.role === "caisse" && p.label === label && p.deviceId !== me);
  if (!twin) return null;
  return (
    <div className="flex shrink-0 items-center justify-center bg-signal px-3 print:hidden py-1.5 text-center text-micro font-bold text-night">
      Une autre tablette est aussi « {label} » — changez de poste et prenez un autre numéro de caisse
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { role, label, isAdmin, reset } = useSession();
  const navigate = useNavigate();
  const items = navItemsFor(role, isAdmin);

  // Toutes les routes authentifiées : chaque écran de l'app est un écran de
  // travail pendant le service.
  useWakeLock();
  usePendingExitWarning();

  const changePoste = () => {
    disconnect();
    reset();
    navigate("/");
  };

  return (
    // À l'impression (récapitulatif), seule la page sort : ni en-tête, ni
    // bandeaux, et plus de hauteur figée qui couperait après la 1re page.
    <div className="flex h-full flex-col print:block print:h-auto">
      <header className="safe-top shrink-0 border-b border-line bg-surface print:hidden">
        {/* Sous `md`, deux lignes : identité + déconnexion, puis la nav sur
            toute la largeur. Sur une seule ligne, un téléphone ne montrait
            que 4 onglets : Soirées, Admin, Aide et la déconnexion étaient
            hors écran, derrière un défilement que rien ne signalait. */}
        <div className="flex flex-wrap items-center gap-x-3 px-3 md:h-16 md:flex-nowrap">
          <div className="flex h-14 min-w-0 shrink-0 items-center gap-2.5 md:h-auto">
            <StorefrontIcon size={26} weight="fill" className="shrink-0 text-lantern" />
            <div className="min-w-0">
              {/* Seul le libellé de poste se laisse tronquer, et seulement
                  sur les écrans étroits. L'état de synchro, lui, reste entier. */}
              <div className="font-display max-w-40 truncate text-body font-bold text-cream md:max-w-28 lg:max-w-none">
                {label ?? "CDF Caisse"}
              </div>
              <SyncIndicator />
            </div>
          </div>

          {/* Libellés partout où ils tiennent : sous l'icône de `md` à `lg`
              (iPad portrait), à côté au-delà. Icônes seules sur téléphone,
              où un libellé lu par lecteur d'écran reste présent. */}
          <nav
            aria-label="Navigation principale"
            className="order-last -mx-1 flex w-[calc(100%+0.5rem)] items-center gap-0.5 pb-1.5 md:order-none md:mx-0 md:ml-auto md:w-auto md:gap-1 md:pb-0"
          >
            {items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                className={({ isActive }) =>
                  cn(
                    "flex h-12 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-control px-1",
                    "font-bold whitespace-nowrap transition-colors",
                    "md:h-14 md:flex-none md:px-2.5 lg:h-12 lg:flex-row lg:gap-2 lg:px-3",
                    isActive
                      ? "bg-lantern text-night"
                      : "text-sand hover:bg-well hover:text-cream",
                  )
                }
              >
                <it.icon size={21} weight="bold" className="shrink-0" />
                <span className="sr-only text-micro md:not-sr-only lg:text-body">{it.label}</span>
              </NavLink>
            ))}
          </nav>

          <button
            onClick={changePoste}
            title="Changer de poste"
            aria-label="Changer de poste"
            className="ml-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-control text-ash transition-colors hover:bg-well hover:text-cream md:ml-0"
          >
            <SignOutIcon size={21} weight="bold" />
          </button>
        </div>
        <div className="guirlande" />
      </header>

      <TrainingBanner />
      <DuplicateRegisterBanner />

      <main className="min-h-0 flex-1 overflow-hidden print:overflow-visible">{children}</main>

      <PendingSalesGuard />
    </div>
  );
}
