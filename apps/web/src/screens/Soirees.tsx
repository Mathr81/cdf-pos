import { useMemo, useState } from "react";
import {
  carteConfig,
  formatAmount,
  parseAmountToCents,
  soireeCarte,
  sortedPresets,
  sortedProducts,
  sortedSoirees,
  type ClientSoiree,
  type PresetItem,
} from "@cdf/shared";
import { projection } from "../lib/store.js";
import { useRev } from "../lib/hooks.js";
import { newId } from "../lib/device.js";
import {
  activateSoiree,
  closeSoiree,
  deleteSoiree,
  deletePreset,
  setSoireeProduct,
  upsertPreset,
  upsertSoiree,
} from "../lib/actions.js";
import { Button, Badge } from "../components/ui.js";
import { Modal } from "../components/Modal.js";
import { cn } from "../lib/cn.js";

export function SoireesScreen() {
  useRev();
  const soirees = sortedSoirees(projection);
  const activeId = projection.activeSoireeId;
  const [creating, setCreating] = useState(false);
  const [carteFor, setCarteFor] = useState<ClientSoiree | null>(null);

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">Soirées</h1>
        <Button variant="primary" onClick={() => setCreating(true)}>
          + Nouvelle soirée
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-4">
        {soirees.map((s) => {
          const isActive = s.id === activeId;
          const carteCount = soireeCarte(projection, s.id).length;
          const orders = Object.values(projection.orders).filter((o) => o.soireeId === s.id).length;
          return (
            <div
              key={s.id}
              className={cn(
                "rounded-2xl border p-3",
                isActive ? "border-emerald-500/50 bg-emerald-500/5" : "border-slate-800 bg-slate-900/60",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-100">{s.name}</span>
                    {isActive && <Badge tone="emerald">Active</Badge>}
                    {s.status === "closed" && <Badge tone="slate">Clôturée</Badge>}
                  </div>
                  <div className="text-xs text-slate-400">
                    {s.date} · {carteCount} produit{carteCount > 1 ? "s" : ""} · {orders} commande{orders > 1 ? "s" : ""}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setCarteFor(s)}>
                    Carte
                  </Button>
                  {!isActive && (
                    <Button variant="success" size="sm" onClick={() => activateSoiree(s.id)}>
                      Activer
                    </Button>
                  )}
                  {isActive && (
                    <Button variant="secondary" size="sm" onClick={() => confirm("Clôturer cette soirée ?") && closeSoiree(s.id)}>
                      Clôturer
                    </Button>
                  )}
                  {orders === 0 && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => confirm(`Supprimer « ${s.name} » ?`) && deleteSoiree(s.id)}
                    >
                      🗑
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {soirees.length === 0 && (
          <p className="mt-10 text-center text-slate-500">
            Aucune soirée. Crée-en une pour commencer à vendre.
          </p>
        )}
      </div>

      {creating && <NewSoireeModal onClose={() => setCreating(false)} onEditCarte={setCarteFor} />}
      {carteFor && <CarteEditor soiree={carteFor} onClose={() => setCarteFor(null)} />}
    </div>
  );
}

function NewSoireeModal({
  onClose,
  onEditCarte,
}: {
  onClose: () => void;
  onEditCarte: (s: ClientSoiree) => void;
}) {
  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [source, setSource] = useState<string>(""); // "" | preset:<id> | soiree:<id>
  const presets = sortedPresets(projection);
  const soirees = sortedSoirees(projection);

  const create = () => {
    const id = newId();
    void upsertSoiree({ id, name: name.trim() || "Soirée", date });

    // Applique la source (preset ou carte d'une autre soirée).
    if (source.startsWith("preset:")) {
      const preset = projection.presets[source.slice(7)];
      preset?.items.forEach((it) =>
        setSoireeProduct({
          soireeId: id,
          productId: it.productId,
          onCarte: true,
          stockInitial: it.stockInitial,
          stockUnlimited: it.stockUnlimited,
          priceOverrideCents: it.priceOverrideCents,
        }),
      );
    } else if (source.startsWith("soiree:")) {
      const srcId = source.slice(7);
      soireeCarte(projection, srcId).forEach((e) => {
        const cfg = carteConfig(projection, srcId, e.product.id)!;
        setSoireeProduct({
          soireeId: id,
          productId: e.product.id,
          onCarte: true,
          stockInitial: cfg.stockInitial,
          stockUnlimited: cfg.stockUnlimited,
          priceOverrideCents: cfg.priceOverrideCents,
        });
      });
    }

    void activateSoiree(id);
    onClose();
    // Ouvre directement l'éditeur de carte pour ajuster.
    onEditCarte({ id, name: name.trim() || "Soirée", date, status: "open", createdAt: new Date().toISOString() });
  };

  return (
    <Modal open onClose={onClose}>
      <h2 className="mb-4 text-lg font-bold text-slate-100">Nouvelle soirée</h2>
      <div className="space-y-3">
        <Field label="Nom">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder="Fête du village…"
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-slate-100 outline-none focus:border-amber-400"
          />
        </Field>
        <Field label="Date">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-slate-100 outline-none focus:border-amber-400"
          />
        </Field>
        <Field label="Partir de">
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-slate-100 outline-none focus:border-amber-400"
          >
            <option value="">Carte vide</option>
            {presets.length > 0 && (
              <optgroup label="Modèles (presets)">
                {presets.map((p) => (
                  <option key={p.id} value={`preset:${p.id}`}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            )}
            {soirees.length > 0 && (
              <optgroup label="Copier une soirée">
                {soirees.map((s) => (
                  <option key={s.id} value={`soiree:${s.id}`}>
                    {s.name} ({s.date})
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </Field>
      </div>
      <div className="mt-5 flex gap-2">
        <Button variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button variant="primary" size="lg" className="flex-1" onClick={create}>
          Créer & activer
        </Button>
      </div>
    </Modal>
  );
}

interface DraftRow {
  onCarte: boolean;
  stockInitial: string;
  stockUnlimited: boolean;
  price: string; // vide = prix catalogue
}

function CarteEditor({ soiree, onClose }: { soiree: ClientSoiree; onClose: () => void }) {
  useRev();
  const products = sortedProducts(projection).filter((p) => p.active);

  const [draft, setDraft] = useState<Record<string, DraftRow>>(() => {
    const d: Record<string, DraftRow> = {};
    for (const p of products) {
      const cfg = carteConfig(projection, soiree.id, p.id);
      d[p.id] = {
        onCarte: cfg?.onCarte ?? false,
        stockInitial: String(cfg?.stockInitial ?? p.stockInitial ?? 0),
        stockUnlimited: cfg?.stockUnlimited ?? p.stockUnlimited ?? false,
        price: cfg?.priceOverrideCents != null ? formatAmount(cfg.priceOverrideCents) : "",
      };
    }
    return d;
  });
  const [savePreset, setSavePreset] = useState(false);

  const set = (id: string, patch: Partial<DraftRow>) =>
    setDraft((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  const onCarteCount = useMemo(() => Object.values(draft).filter((r) => r.onCarte).length, [draft]);

  const save = () => {
    for (const p of products) {
      const r = draft[p.id];
      const cfg = carteConfig(projection, soiree.id, p.id);
      const priceOverrideCents = r.price.trim() ? parseAmountToCents(r.price) : null;
      const stockInitial = Number(r.stockInitial) || 0;
      // N'émet que si changé (ou si nouvellement configuré).
      const changed =
        !cfg ||
        cfg.onCarte !== r.onCarte ||
        cfg.stockInitial !== stockInitial ||
        cfg.stockUnlimited !== r.stockUnlimited ||
        (cfg.priceOverrideCents ?? null) !== priceOverrideCents;
      if (changed && (r.onCarte || cfg)) {
        void setSoireeProduct({
          soireeId: soiree.id,
          productId: p.id,
          onCarte: r.onCarte,
          stockInitial,
          stockUnlimited: r.stockUnlimited,
          priceOverrideCents,
        });
      }
    }
    onClose();
  };

  const saveAsPreset = (presetName: string) => {
    const items: PresetItem[] = products
      .filter((p) => draft[p.id].onCarte)
      .map((p) => ({
        productId: p.id,
        stockInitial: Number(draft[p.id].stockInitial) || 0,
        stockUnlimited: draft[p.id].stockUnlimited,
        priceOverrideCents: draft[p.id].price.trim() ? parseAmountToCents(draft[p.id].price) : null,
      }));
    void upsertPreset({ id: newId(), name: presetName, items });
  };

  return (
    <Modal open onClose={onClose} className="max-w-2xl">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Carte — {soiree.name}</h2>
          <p className="text-xs text-slate-400">{onCarteCount} produit(s) sur la carte</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setSavePreset(true)}>
          💾 Enregistrer comme modèle
        </Button>
      </div>

      <div className="max-h-[60vh] space-y-1.5 overflow-y-auto pr-1">
        {products.map((p) => {
          const r = draft[p.id];
          return (
            <div
              key={p.id}
              className={cn(
                "flex flex-wrap items-center gap-2 rounded-xl border p-2",
                r.onCarte ? "border-slate-700 bg-slate-800/60" : "border-slate-800 bg-slate-900/40 opacity-70",
              )}
            >
              <label className="flex flex-1 cursor-pointer items-center gap-2">
                <input type="checkbox" checked={r.onCarte} onChange={(e) => set(p.id, { onCarte: e.target.checked })} className="h-5 w-5" />
                <span className="text-lg">{p.emoji}</span>
                <span className="text-sm font-semibold text-slate-100">{p.name}</span>
              </label>
              {r.onCarte && (
                <div className="flex items-center gap-2">
                  <input
                    value={r.price}
                    onChange={(e) => set(p.id, { price: e.target.value })}
                    inputMode="decimal"
                    placeholder={formatAmount(p.priceCents)}
                    className="w-16 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-right text-sm text-slate-100 outline-none focus:border-amber-400"
                    title="Prix (vide = prix catalogue)"
                  />
                  <span className="text-xs text-slate-500">€</span>
                  <label className="flex items-center gap-1 text-xs text-slate-400" title="Stock illimité">
                    <input type="checkbox" checked={r.stockUnlimited} onChange={(e) => set(p.id, { stockUnlimited: e.target.checked })} className="h-4 w-4" />∞
                  </label>
                  {!r.stockUnlimited && (
                    <input
                      value={r.stockInitial}
                      onChange={(e) => set(p.id, { stockInitial: e.target.value })}
                      inputMode="numeric"
                      className="w-16 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-right text-sm text-slate-100 outline-none focus:border-amber-400"
                      title="Stock initial"
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
        {products.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-500">Aucun produit au catalogue. Crée-en dans l'onglet Produits.</p>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <Button variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button variant="primary" size="lg" className="flex-1" onClick={save}>
          Enregistrer la carte
        </Button>
      </div>

      {savePreset && (
        <PresetNameModal
          onClose={() => setSavePreset(false)}
          onSave={(n) => {
            saveAsPreset(n);
            setSavePreset(false);
          }}
        />
      )}
    </Modal>
  );
}

function PresetNameModal({ onClose, onSave }: { onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState("");
  const presets = sortedPresets(projection);
  return (
    <Modal open onClose={onClose}>
      <h2 className="mb-3 text-lg font-bold text-slate-100">Enregistrer comme modèle</h2>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        placeholder="Nom du modèle (ex : Carte burgers)"
        className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-slate-100 outline-none focus:border-amber-400"
      />
      {presets.length > 0 && (
        <div className="mt-3 space-y-1">
          <p className="text-xs text-slate-500">Modèles existants :</p>
          {presets.map((pr) => (
            <div key={pr.id} className="flex items-center gap-2 text-sm text-slate-300">
              <span className="flex-1">{pr.name}</span>
              <button onClick={() => deletePreset(pr.id)} className="text-slate-500 hover:text-rose-400">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 flex gap-2">
        <Button variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button variant="primary" className="flex-1" disabled={!name.trim()} onClick={() => onSave(name.trim())}>
          Enregistrer
        </Button>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      {children}
    </label>
  );
}
