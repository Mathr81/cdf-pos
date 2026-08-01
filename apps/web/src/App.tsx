import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useSession } from "./lib/session.js";
import { connect, hydrateFromLog } from "./lib/sync.js";
import { Layout } from "./components/Layout.js";
import { RoleSelect } from "./screens/RoleSelect.js";
import { CaisseScreen } from "./screens/Caisse.js";
import { CuisineScreen } from "./screens/Cuisine.js";
import { InventaireScreen } from "./screens/Inventaire.js";
import { StatsScreen } from "./screens/Stats.js";
import { AdminScreen } from "./screens/Admin.js";

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

  if (!booted) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">Chargement…</div>
    );
  }

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
        <Route path="/stats" element={<StatsScreen />} />
        <Route path="/admin" element={<AdminScreen />} />
        <Route path="*" element={<Navigate to={homeFor(role)} replace />} />
      </Routes>
    </Layout>
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
