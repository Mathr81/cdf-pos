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

import { useSession } from "../lib/session.js";
import { useStore } from "../lib/store.js";
import { disconnect } from "../lib/sync.js";
import { cn } from "../lib/cn.js";

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
  if (isAdmin) return [caisse, cuisine, inventaire, journal, stats, soirees, admin];
  switch (role) {
    case "cuisine":
      return [cuisine];
    case "stats":
      return [stats];
    case "admin":
      return [soirees, caisse, cuisine, inventaire, journal, stats, admin];
    default:
      return [caisse, inventaire];
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

export function Layout({ children }: { children: ReactNode }) {
  const { role, label, isAdmin, reset } = useSession();
  const navigate = useNavigate();
  const items = navItemsFor(role, isAdmin);

  const changePoste = () => {
    disconnect();
    reset();
    navigate("/");
  };

  return (
    <div className="flex h-full flex-col">
      <header className="safe-top shrink-0 border-b border-line bg-surface">
        <div className="flex h-16 items-center justify-between gap-3 px-3">
          <div className="flex shrink-0 items-center gap-2.5">
            <StorefrontIcon size={26} weight="fill" className="shrink-0 text-lantern" />
            <div>
              {/* Seul le libellé de poste se laisse tronquer, et seulement
                  sur les écrans étroits. L'état de synchro, lui, reste entier. */}
              <div className="font-display max-w-28 truncate text-body font-bold text-cream sm:max-w-none">
                {label ?? "CDF Caisse"}
              </div>
              <SyncIndicator />
            </div>
          </div>

          {/* Nav sur une seule ligne : libellés à partir de lg (iPad
              paysage), icônes seules en dessous. À 768px les 7 items
              tenaient auparavant hors écran. */}
          <nav className="flex items-center gap-1 overflow-x-auto">
            {items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                title={it.label}
                className={({ isActive }) =>
                  cn(
                    "flex h-12 min-w-12 items-center justify-center gap-2 rounded-control px-3",
                    "text-body font-bold whitespace-nowrap transition-colors",
                    isActive
                      ? "bg-lantern text-night"
                      : "text-sand hover:bg-well hover:text-cream",
                  )
                }
              >
                <it.icon size={21} weight="bold" />
                <span className="hidden lg:inline">{it.label}</span>
              </NavLink>
            ))}
            <button
              onClick={changePoste}
              title="Changer de poste"
              aria-label="Changer de poste"
              className="ml-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-control text-ash transition-colors hover:bg-well hover:text-cream"
            >
              <SignOutIcon size={21} weight="bold" />
            </button>
          </nav>
        </div>
        <div className="guirlande" />
      </header>

      <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
