import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useSession } from "../lib/session.js";
import { useStore } from "../lib/store.js";
import { disconnect } from "../lib/sync.js";
import { cn } from "../lib/cn.js";

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

function navItemsFor(role: string | null, isAdmin: boolean): NavItem[] {
  const caisse = { to: "/caisse", label: "Caisse", icon: "🧾" };
  const cuisine = { to: "/cuisine", label: "Cuisine", icon: "👨‍🍳" };
  const inventaire = { to: "/inventaire", label: "Stock", icon: "📦" };
  const journal = { to: "/journal", label: "Journal", icon: "📒" };
  const stats = { to: "/stats", label: "Stats", icon: "📊" };
  const soirees = { to: "/soirees", label: "Soirées", icon: "🎉" };
  const admin = { to: "/admin", label: "Admin", icon: "⚙️" };
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

function ConnectionDot() {
  const connected = useStore((s) => s.connected);
  const pending = useStore((s) => s.pending);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className={cn(
          "inline-block h-2.5 w-2.5 rounded-full",
          connected ? "bg-emerald-400" : "bg-rose-500",
        )}
      />
      <span className="text-slate-400">
        {connected ? "En ligne" : "Hors ligne"}
        {pending > 0 && (
          <span className="ml-1 text-amber-300">· {pending} en attente</span>
        )}
      </span>
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
      <header className="safe-top flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/80 px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-lg">🍔</span>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-slate-100">
              {label ?? "CDF Caisse"}
            </div>
            <ConnectionDot />
          </div>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-amber-500 text-slate-950"
                    : "text-slate-300 hover:bg-slate-800",
                )
              }
            >
              <span>{it.icon}</span>
              <span className="hidden sm:inline">{it.label}</span>
            </NavLink>
          ))}
          <button
            onClick={changePoste}
            className="ml-1 rounded-lg px-3 py-2 text-sm font-semibold text-slate-400 hover:bg-slate-800"
            title="Changer de poste"
          >
            ⎋
          </button>
        </nav>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
