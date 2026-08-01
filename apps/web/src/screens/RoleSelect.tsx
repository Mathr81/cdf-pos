import { useState } from "react";
import type { Role } from "@cdf/shared";
import { api } from "../lib/api.js";
import { useSession } from "../lib/session.js";
import { Button, Card } from "../components/ui.js";
import { cn } from "../lib/cn.js";

type Step = "code" | "role";

interface Station {
  id: string;
  name: string;
}

export function RoleSelect() {
  const setSession = useSession((s) => s.setSession);
  const [step, setStep] = useState<Step>("code");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [stations, setStations] = useState<Station[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Sélection de poste
  const [role, setRole] = useState<Role>("caisse");
  const [registerLabel, setRegisterLabel] = useState("Caisse 1");
  const [stationId, setStationId] = useState<string>("");
  const [cashierName, setCashierName] = useState("");

  async function submitCode() {
    setError(null);
    setBusy(true);
    try {
      const res = await api.checkAuth(code, pin || undefined);
      if (!res.ok) throw new Error("Code d'accès invalide");
      setIsAdmin(res.isAdmin);
      // On stocke le code pour autoriser les appels suivants (/state).
      setSession({ accessCode: code, adminPin: pin || null, isAdmin: res.isAdmin });
      const state = await api.getState().catch(() => ({ stations: [] as Station[] }));
      setStations(state.stations);
      if (state.stations[0]) setStationId(state.stations[0].id);
      setStep("role");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function confirmRole() {
    const label =
      role === "caisse"
        ? registerLabel
        : role === "cuisine"
          ? (stations.find((s) => s.id === stationId)?.name ?? "Cuisine")
          : role === "admin"
            ? "Administration"
            : "Statistiques";
    setSession({
      role,
      label,
      cashierName: cashierName || null,
      // On mémorise la station choisie dans le libellé ; l'écran cuisine lit stationId séparément.
    });
    if (role === "cuisine") localStorage.setItem("cdf.stationId", stationId);
  }

  return (
    <div className="flex h-full items-center justify-center bg-gradient-to-b from-slate-950 to-slate-900 p-4">
      <Card className="w-full max-w-md p-6 animate-fade-in">
        <div className="mb-6 text-center">
          <div className="text-4xl">🍔</div>
          <h1 className="mt-2 text-2xl font-bold text-slate-100">CDF Caisse</h1>
          <p className="text-sm text-slate-400">Comité des fêtes</p>
        </div>

        {step === "code" && (
          <div className="space-y-4">
            <Field label="Code d'accès">
              <input
                type="password"
                inputMode="text"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && code && submitCode()}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-lg text-slate-100 outline-none focus:border-amber-400"
                placeholder="••••••"
              />
            </Field>
            <Field label="PIN administrateur (optionnel)">
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-lg text-slate-100 outline-none focus:border-amber-400"
                placeholder="pour accéder à l'admin / stats"
              />
            </Field>
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              disabled={!code || busy}
              onClick={submitCode}
            >
              {busy ? "Vérification…" : "Continuer"}
            </Button>
          </div>
        )}

        {step === "role" && (
          <div className="space-y-5">
            <Field label="Poste">
              <div className="grid grid-cols-2 gap-2">
                <RoleTile active={role === "caisse"} onClick={() => setRole("caisse")} icon="🧾" label="Caisse" />
                <RoleTile active={role === "cuisine"} onClick={() => setRole("cuisine")} icon="👨‍🍳" label="Cuisine" />
                {isAdmin && (
                  <>
                    <RoleTile active={role === "stats"} onClick={() => setRole("stats")} icon="📊" label="Stats" />
                    <RoleTile active={role === "admin"} onClick={() => setRole("admin")} icon="⚙️" label="Admin" />
                  </>
                )}
              </div>
            </Field>

            {role === "caisse" && (
              <>
                <Field label="Nom de la caisse">
                  <div className="grid grid-cols-3 gap-2">
                    {["Caisse 1", "Caisse 2", "Caisse 3"].map((c) => (
                      <RoleTile key={c} active={registerLabel === c} onClick={() => setRegisterLabel(c)} label={c} />
                    ))}
                  </div>
                </Field>
                <Field label="Ton prénom (optionnel)">
                  <input
                    value={cashierName}
                    onChange={(e) => setCashierName(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 outline-none focus:border-amber-400"
                    placeholder="pour les statistiques"
                  />
                </Field>
              </>
            )}

            {role === "cuisine" && (
              <Field label="Poste cuisine">
                {stations.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    Aucune station configurée. Demande à l'admin de les créer.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {stations.map((s) => (
                      <RoleTile
                        key={s.id}
                        active={stationId === s.id}
                        onClick={() => setStationId(s.id)}
                        label={s.name}
                      />
                    ))}
                  </div>
                )}
              </Field>
            )}

            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep("code")}>
                Retour
              </Button>
              <Button
                variant="primary"
                size="lg"
                className="flex-1"
                disabled={role === "cuisine" && !stationId}
                onClick={confirmRole}
              >
                Démarrer
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function RoleTile({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon?: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 rounded-xl border px-3 py-3 text-sm font-semibold transition-colors",
        active
          ? "border-amber-400 bg-amber-500/20 text-amber-200"
          : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600",
      )}
    >
      {icon && <span className="text-xl">{icon}</span>}
      <span>{label}</span>
    </button>
  );
}
