import { useNavigate } from "react-router-dom";
import { ConfettiIcon } from "@phosphor-icons/react/dist/csr/Confetti";
import { useSession } from "../lib/session.js";
import { Button, EmptyState } from "./ui.js";

/** Écran affiché quand aucune soirée n'est active (bloque caisse/cuisine/stock). */
export function NoSoiree() {
  const navigate = useNavigate();
  const isAdmin = useSession((s) => s.isAdmin);
  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        icon={<ConfettiIcon size={52} weight="light" />}
        title="Aucune soirée active"
        hint={
          isAdmin
            ? "Démarre une soirée dans l'administration pour commencer à encaisser."
            : "Un responsable doit démarrer une soirée dans l'administration."
        }
        action={
          isAdmin ? (
            <Button variant="primary" size="lg" onClick={() => navigate("/admin")}>
              Aller à l'administration
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}
