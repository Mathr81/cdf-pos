import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useSession } from "./lib/session.js";
import { connect, hydrateFromLog } from "./lib/sync.js";
import { Layout } from "./components/Layout.js";
import { Skeleton } from "./components/ui.js";
import { RoleSelect } from "./screens/RoleSelect.js";
import { CaisseScreen } from "./screens/Caisse.js";
import { CuisineScreen } from "./screens/Cuisine.js";
import { InventaireScreen } from "./screens/Inventaire.js";
import { StatsScreen } from "./screens/Stats.js";
import { AdminScreen } from "./screens/admin/AdminScreen.js";
import { SoireesScreen } from "./screens/Soirees.js";
import { JournalScreen } from "./screens/Journal.js";
import { AideScreen } from "./screens/Aide.js";

export function App() {
  const role = useSession((s) => s.role);
  const [booted, setBooted] = useState(false);

  // Hydratation locale (offline) puis connexion temps réel.
  useEffect(() => {
    let active = true;
    hydrateFromLog().finally(() => {
      if (active) setBooted(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (role) connect();
  }, [role]);

  if (!booted) return <BootSkeleton />;

  if (!role) {
    return <RoleSelect />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to={homeFor(role)} replace />} />
        <Route path="/caisse" element={<CaisseScreen />} />
        <Route path="/cuisine" element={<CuisineScreen />} />
        <Route path="/inventaire" element={<InventaireScreen />} />
        <Route path="/journal" element={<JournalScreen />} />
        <Route path="/stats" element={<StatsScreen />} />
        <Route path="/soirees" element={<SoireesScreen />} />
        <Route path="/admin" element={<AdminScreen />} />
        <Route path="/aide" element={<AideScreen />} />
        <Route path="*" element={<Navigate to={homeFor(role)} replace />} />
      </Routes>
    </Layout>
  );
}

/**
 * Chargement : squelette calé sur la forme de l'écran de caisse (barre de
 * filtres puis grille de tuiles), plutôt qu'un texte gris centré. L'attente
 * ressemble à ce qui arrive.
 */
function BootSkeleton() {
  return (
    <div className="flex h-full flex-col p-3" aria-busy="true" aria-label="Chargement">
      <div className="mb-3 flex gap-2">
        <Skeleton className="h-11 w-32" />
        <Skeleton className="h-11 w-24" />
        <Skeleton className="h-11 w-24" />
      </div>
      <div className="tile-grid flex-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} />
        ))}
      </div>
    </div>
  );
}

function homeFor(role: string): string {
  switch (role) {
    case "cuisine":
      return "/cuisine";
    case "admin":
      return "/admin";
    case "stats":
      return "/stats";
    default:
      return "/caisse";
  }
}
