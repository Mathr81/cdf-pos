import { useNavigate } from "react-router-dom";
import { useSession } from "../lib/session.js";
import { Button } from "./ui.js";

/** Écran affiché quand aucune soirée n'est active (bloque caisse/cuisine/stock). */
export function NoSoiree() {
  const navigate = useNavigate();
  const isAdmin = useSession((s) => s.isAdmin);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="text-5xl">🎉</div>
      <h2 className="text-xl font-bold text-slate-100">Aucune soirée active</h2>
      <p className="max-w-sm text-sm text-slate-400">
        {isAdmin
          ? "Démarre une soirée dans l'administration pour commencer à encaisser."
          : "Un responsable doit démarrer une soirée dans l'administration."}
      </p>
      {isAdmin && (
        <Button variant="primary" className="mt-2" onClick={() => navigate("/admin")}>
          Aller à l'administration
        </Button>
      )}
    </div>
  );
}
