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
import { ConfettiIcon } from "@phosphor-icons/react/dist/csr/Confetti";
import { FloppyDiskIcon } from "@phosphor-icons/react/dist/csr/FloppyDisk";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";

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
import {
  Badge,
  Button,
  EmptyState,
  Field,
  SelectInput,
  TextInput,
} from "../components/ui.js";
import { TicketBlock } from "../components/ProductIcon.js";
import { Modal } from "../components/Modal.js";
import { ConfirmModal } from "../components/ConfirmModal.js";
import { cn } from "../lib/cn.js";

export function SoireesScreen() {
  useRev();
  const soirees = sortedSoirees(projection);
  const activeId = projection.activeSoireeId;
  const [creating, setCreating] = useState(false);
  const [carteFor, setCarteFor] = useState<ClientSoiree | null>(null);
  const [closing, setClosing] = useState<ClientSoiree | null>(null);
  const [deleting, setDeleting] = useState<ClientSoiree | null>(null);

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col p-4">
      <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
        <h1 className="font-display text-title font-bold text-cream">Soirées</h1>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <PlusIcon size={18} weight="bold" />
          Nouvelle soirée
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        {soirees.length === 0 ? (
          <EmptyState
            icon={<ConfettiIcon size={44} weight="light" />}
            title="Aucune soirée"
            hint="Crée une soirée pour commencer à vendre. Tu pourras partir d'un modèle ou copier une carte existante."
            action={
              <Button variant="primary" size="lg" onClick={() => setCreating(true)}>
                Créer une soirée
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {soirees.map((s) => {
              const isActive = s.id === activeId;
              const carteCount = soireeCarte(projection, s.id).length;
              const orders = Object.values(projection.orders).filter(
                (o) => o.soireeId === s.id,
              ).length;
              return (
                <div
                  key={s.id}
                  className={cn(
                    "rounded-surface border p-3",
                    isActive ? "border-mint bg-mint/10" : "border-line bg-surface",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-lead font-bold text-cream">
                          {s.name}
                        </span>
                        {isActive && <Badge tone="mint">Active</Badge>}
                        {s.status === "closed" && <Badge tone="neutral">Clôturée</Badge>}
                        {/* Visible dès la liste : sans ça, on ne distingue une
                            session d'exercice d'une vraie soirée qu'en lisant
                            son nom, et les chiffres semblent avoir disparu. */}
                        {s.training && <Badge tone="lantern">Entraînement</Badge>}
                      </div>
                      <div className="tnum text-micro text-sand">
                        {s.date} · {carteCount} produit{carteCount > 1 ? "s" : ""} · {orders}{" "}
                        commande{orders > 1 ? "s" : ""}
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
                        <Button variant="secondary" size="sm" onClick={() => setClosing(s)}>
                          Clôturer
                        </Button>
                      )}
                      {orders === 0 && (
                        <Button
                          variant="danger"
                          size="sm"
                          aria-label={`Supprimer ${s.name}`}
                          onClick={() => setDeleting(s)}
                        >
                          <TrashIcon size={17} weight="bold" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {creating && <NewSoireeModal onClose={() => setCreating(false)} onEditCarte={setCarteFor} />}
      {carteFor && <CarteEditor soiree={carteFor} onClose={() => setCarteFor(null)} />}

      <ConfirmModal
        open={closing !== null}
        title="Clôturer cette soirée ?"
        body={
          closing
            ? `« ${closing.name} » ne sera plus la soirée active. Les ventes déjà enregistrées sont conservées.`
            : undefined
        }
        confirmLabel="Clôturer"
        tone="primary"
        onConfirm={() => closing && closeSoiree(closing.id)}
        onClose={() => setClosing(null)}
      />
      <ConfirmModal
        open={deleting !== null}
        title="Supprimer cette soirée ?"
        body={
          deleting
            ? `« ${deleting.name} » sera retirée sur tous les postes. Cette soirée ne contient aucune commande.`
            : undefined
        }
        confirmLabel="Supprimer"
        onConfirm={() => deleting && deleteSoiree(deleting.id)}
        onClose={() => setDeleting(null)}
      />
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
  const [training, setTraining] = useState(false);
  const presets = sortedPresets(projection);
  const soirees = sortedSoirees(projection);

  const create = () => {
    const id = newId();
    void upsertSoiree({ id, name: name.trim() || "Soirée", date, training });

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
    onEditCarte({
      id,
      name: name.trim() || "Soirée",
      date,
      status: "open",
      createdAt: new Date().toISOString(),
      training,
    });
  };

  return (
    <Modal open onClose={onClose}>
      <h2 className="font-display mb-4 text-lead font-bold text-cream">Nouvelle soirée</h2>
      <div className="space-y-3">
        <Field label="Nom">
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder="Fête du village"
          />
        </Field>
        <Field label="Date">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Partir de">
          <SelectInput
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-full"
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
          </SelectInput>
        </Field>

        {/* Case à cocher plutôt qu'un mode séparé : une soirée d'entraînement
            doit se comporter EXACTEMENT comme une vraie, sinon on n'entraîne
            personne. Seuls les chiffres l'ignorent. */}
        <label className="flex cursor-pointer items-start gap-3 rounded-control border border-line bg-well p-3">
          <input
            type="checkbox"
            checked={training}
            onChange={(e) => setTraining(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-lantern"
          />
          <span>
            <span className="block text-body font-bold text-cream">Soirée d'entraînement</span>
            <span className="block text-micro text-sand">
              Pour former les bénévoles. Tout fonctionne normalement, mais les ventes n'entrent ni
              dans les totaux « toutes soirées » ni dans la comparaison avec le service précédent.
            </span>
          </span>
        </label>
      </div>
      <div className="mt-6 flex gap-2">
        <Button variant="ghost" size="lg" onClick={onClose}>
          Annuler
        </Button>
        <Button variant="primary" size="lg" className="flex-1" onClick={create}>
          Créer et activer
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
        priceOverrideCents: draft[p.id].price.trim()
          ? parseAmountToCents(draft[p.id].price)
          : null,
      }));
    void upsertPreset({ id: newId(), name: presetName, items });
  };

  return (
    <Modal open onClose={onClose} className="max-w-2xl">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lead font-bold text-cream">Carte de {soiree.name}</h2>
          <p className="tnum text-micro text-ash">{onCarteCount} produit(s) sur la carte</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setSavePreset(true)}>
          <FloppyDiskIcon size={17} weight="bold" />
          Enregistrer comme modèle
        </Button>
      </div>

      <div className="max-h-[58vh] space-y-1.5 overflow-y-auto pr-1">
        {products.map((p) => {
          const r = draft[p.id];
          return (
            <div
              key={p.id}
              className={cn(
                "flex flex-wrap items-center gap-2 rounded-control border p-2",
                r.onCarte ? "border-line bg-surface" : "border-transparent opacity-60",
              )}
            >
              <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={r.onCarte}
                  onChange={(e) => set(p.id, { onCarte: e.target.checked })}
                  className="h-6 w-6 shrink-0 accent-lantern"
                />
                <TicketBlock
                  emoji={p.emoji}
                  color={p.color}
                  imageKey={p.imageKey}
                  imageZoom={p.imageZoom}
                  iconSize={16}
                  className="h-9 w-9"
                />
                <span className="truncate text-body font-bold text-cream">{p.name}</span>
              </label>
              {r.onCarte && (
                <div className="flex items-center gap-2">
                  <TextInput
                    value={r.price}
                    onChange={(e) => set(p.id, { price: e.target.value })}
                    inputMode="decimal"
                    placeholder={formatAmount(p.priceCents)}
                    aria-label={`Prix de ${p.name}`}
                    title="Prix (vide = prix catalogue)"
                    className="tnum w-20 min-h-11 text-right"
                  />
                  <span className="text-micro text-ash">€</span>
                  <label
                    className="flex min-h-11 cursor-pointer items-center gap-1.5 text-micro text-sand"
                    title="Stock illimité"
                  >
                    <input
                      type="checkbox"
                      checked={r.stockUnlimited}
                      onChange={(e) => set(p.id, { stockUnlimited: e.target.checked })}
                      className="h-5 w-5 accent-lantern"
                    />
                    illimité
                  </label>
                  {!r.stockUnlimited && (
                    <TextInput
                      value={r.stockInitial}
                      onChange={(e) => set(p.id, { stockInitial: e.target.value })}
                      inputMode="numeric"
                      aria-label={`Stock initial de ${p.name}`}
                      title="Stock initial"
                      className="tnum w-20 min-h-11 text-right"
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
        {products.length === 0 && (
          <p className="py-6 text-center text-body text-ash">
            Aucun produit au catalogue. Crée-en dans l'onglet Produits.
          </p>
        )}
      </div>

      <div className="mt-5 flex gap-2">
        <Button variant="ghost" size="lg" onClick={onClose}>
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

function PresetNameModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const presets = sortedPresets(projection);
  return (
    <Modal open onClose={onClose}>
      <h2 className="font-display mb-3 text-lead font-bold text-cream">
        Enregistrer comme modèle
      </h2>
      <TextInput
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        placeholder="Nom du modèle (ex : Carte burgers)"
        aria-label="Nom du modèle"
      />
      {presets.length > 0 && (
        <div className="mt-4">
          <p className="mb-1 text-micro font-bold tracking-wide text-ash uppercase">
            Modèles existants
          </p>
          <div className="divide-y divide-line">
            {presets.map((pr) => (
              <div key={pr.id} className="flex items-center gap-2 py-1 text-body text-sand">
                <span className="min-w-0 flex-1 truncate">{pr.name}</span>
                <button
                  onClick={() => deletePreset(pr.id)}
                  aria-label={`Supprimer le modèle ${pr.name}`}
                  className="flex h-11 w-11 items-center justify-center text-ash transition-colors hover:text-signal"
                >
                  <XIcon size={16} weight="bold" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="mt-5 flex gap-2">
        <Button variant="ghost" size="lg" onClick={onClose}>
          Annuler
        </Button>
        <Button
          variant="primary"
          size="lg"
          className="flex-1"
          disabled={!name.trim()}
          onClick={() => onSave(name.trim())}
        >
          Enregistrer
        </Button>
      </div>
    </Modal>
  );
}
