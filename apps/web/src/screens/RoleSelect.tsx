import { useState } from "react";
import type { Role } from "@cdf/shared";
import type { Icon } from "@phosphor-icons/react";
import { ChartBarIcon } from "@phosphor-icons/react/dist/csr/ChartBar";
import { ChefHatIcon } from "@phosphor-icons/react/dist/csr/ChefHat";
import { GearIcon } from "@phosphor-icons/react/dist/csr/Gear";
import { ReceiptIcon } from "@phosphor-icons/react/dist/csr/Receipt";
import { StorefrontIcon } from "@phosphor-icons/react/dist/csr/Storefront";

import { api } from "../lib/api.js";
import { useSession } from "../lib/session.js";
import { Button, Field, TextInput } from "../components/ui.js";
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
    <div className="flex h-full items-center justify-center overflow-y-auto p-4">
      <div className="animate-rise-in w-full max-w-md">
        {/* Le seul écran sans contrainte de rush : c'est ici que l'identité
            s'exprime pleinement. */}
        <div className="mb-6 text-center">
          <StorefrontIcon size={52} weight="fill" className="mx-auto text-lantern" />
          <h1 className="font-display mt-3 text-display font-bold text-cream">CDF Caisse</h1>
          <p className="text-body text-sand">Comité des fêtes</p>
          <div className="guirlande mx-auto mt-5 w-40" />
        </div>

        <div className="rounded-surface border border-line bg-surface p-6">
          {step === "code" && (
            <div className="space-y-4">
              <Field label="Code d'accès">
                <TextInput
                  type="password"
                  inputMode="text"
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && code && submitCode()}
                  className="min-h-14 text-lead"
                  placeholder="Code remis par le responsable"
                />
              </Field>
              <Field label="PIN administrateur (optionnel)">
                <TextInput
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="min-h-14 text-lead"
                  placeholder="pour accéder à l'admin / stats"
                />
              </Field>
              {error && <p className="text-body font-semibold text-signal">{error}</p>}
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
                  <RoleTile
                    active={role === "caisse"}
                    onClick={() => setRole("caisse")}
                    icon={ReceiptIcon}
                    label="Caisse"
                  />
                  <RoleTile
                    active={role === "cuisine"}
                    onClick={() => setRole("cuisine")}
                    icon={ChefHatIcon}
                    label="Cuisine"
                  />
                  {isAdmin && (
                    <>
                      <RoleTile
                        active={role === "stats"}
                        onClick={() => setRole("stats")}
                        icon={ChartBarIcon}
                        label="Stats"
                      />
                      <RoleTile
                        active={role === "admin"}
                        onClick={() => setRole("admin")}
                        icon={GearIcon}
                        label="Admin"
                      />
                    </>
                  )}
                </div>
              </Field>

              {role === "caisse" && (
                <>
                  <Field label="Nom de la caisse">
                    <div className="grid grid-cols-3 gap-2">
                      {["Caisse 1", "Caisse 2", "Caisse 3"].map((c) => (
                        <RoleTile
                          key={c}
                          active={registerLabel === c}
                          onClick={() => setRegisterLabel(c)}
                          label={c}
                        />
                      ))}
                    </div>
                  </Field>
                  <Field label="Ton prénom (optionnel)">
                    <TextInput
                      value={cashierName}
                      onChange={(e) => setCashierName(e.target.value)}
                      placeholder="pour les statistiques"
                    />
                  </Field>
                </>
              )}

              {role === "cuisine" && (
                <Field label="Poste cuisine">
                  {stations.length === 0 ? (
                    <p className="text-body text-sand">
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
                <Button variant="ghost" size="lg" onClick={() => setStep("code")}>
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
        </div>
      </div>
    </div>
  );
}

function RoleTile({
  active,
  onClick,
  icon: Glyph,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon?: Icon;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-control border px-3 py-3",
        "text-body font-bold transition-colors active:scale-[0.97]",
        active
          ? "border-lantern bg-lantern/20 text-lantern"
          : "border-line bg-well text-sand hover:text-cream",
      )}
    >
      {Glyph && <Glyph size={26} weight="fill" />}
      <span>{label}</span>
    </button>
  );
}
