import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";

import { projection } from "../lib/store.js";
import { useRev } from "../lib/hooks.js";
import { newId } from "../lib/device.js";
import { isAmount, isCount } from "../lib/validate.js";
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
import { plural } from "../lib/plural.js";

export function SoireesScreen() {
  useRev();
  const navigate = useNavigate();
  const soirees = sortedSoirees(projection);
  const activeId = projection.activeSoireeId;
  const [creating, setCreating] = useState(false);
  const [carteFor, setCarteFor] = useState<ClientSoiree | null>(null);
  const [closing, setClosing] = useState<ClientSoiree | null>(null);
  const [deleting, setDeleting] = useState<ClientSoiree | null>(null);
  const [activating, setActivating] = useState<ClientSoiree | null>(null);
  const active = activeId ? projection.soirees[activeId] : undefined;

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
                      {orders > 0 && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => navigate(`/recap?soiree=${encodeURIComponent(s.id)}`)}
                        >
                          Récap
                        </Button>
                      )}
                      {!isActive && (
                        <Button
                          variant="success"
                          size="sm"
                          // Changer de soirée bascule TOUTES les caisses : jamais
                          // en un seul tap quand une autre est en cours.
                          onClick={() => (active ? setActivating(s) : void activateSoiree(s.id))}
                        >
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
        open={activating !== null}
        title={`Activer « ${activating?.name ?? ""} » ?`}
        body={
          active
            ? `« ${active.name} » cessera d'être la soirée active. Toutes les caisses, la cuisine et le stock basculent immédiatement sur « ${activating?.name ?? ""} ».`
            : undefined
        }
        confirmLabel="Activer"
        tone="primary"
        onConfirm={() => activating && activateSoiree(activating.id)}
        onClose={() => setActivating(null)}
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
  // Date LOCALE (sv-SE formate en AAAA-MM-JJ) : toISOString donnerait la
  // veille pour une soirée créée entre minuit et 2 h.
  const [date, setDate] = useState(new Date().toLocaleDateString("sv-SE"));
  const [source, setSource] = useState<string>(""); // "" | preset:<id> | soiree:<id>
  const [training, setTraining] = useState(false);
  const presets = sortedPresets(projection);
  const soirees = sortedSoirees(projection);
  const current = projection.activeSoireeId ? projection.soirees[projection.activeSoireeId] : undefined;

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
    <Modal open onClose={onClose} dismissable={!name.trim()}>
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
      {current && (
        <p className="mt-4 text-body text-sand">
          « <b className="text-cream">{current.name}</b> » cessera d'être la soirée active : toutes les
          caisses basculeront sur la nouvelle.
        </p>
      )}
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
  const [q, setQ] = useState("");
  const [initial] = useState(() => JSON.stringify(draft));
  const dirty = JSON.stringify(draft) !== initial;
  const rowError = (r: DraftRow) =>
    r.onCarte &&
    ((r.price.trim() !== "" && !isAmount(r.price)) || (!r.stockUnlimited && !isCount(r.stockInitial)));
  const invalidCount = Object.values(draft).filter(rowError).length;
  const needle = q.trim().toLowerCase();
  const shown = needle ? products.filter((p) => p.name.toLowerCase().includes(needle)) : products;

  const set = (id: string, patch: Partial<DraftRow>) =>
    setDraft((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  const onCarteCount = useMemo(() => Object.values(draft).filter((r) => r.onCarte).length, [draft]);

  const save = () => {
    if (invalidCount > 0) return;
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
    <Modal open onClose={onClose} wide dismissable={!dirty}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lead font-bold text-cream">Carte de {soiree.name}</h2>
          <p className="tnum text-micro text-ash">{plural(onCarteCount, "produit")} sur la carte</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setSavePreset(true)}>
          <FloppyDiskIcon size={17} weight="bold" />
          Enregistrer comme modèle
        </Button>
      </div>

      {products.length > 8 && (
        <div className="relative mb-2">
          <MagnifyingGlassIcon
            size={17}
            weight="bold"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ash"
          />
          <TextInput
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un produit"
            aria-label="Rechercher un produit"
            className="pl-9"
          />
        </div>
      )}

      <div className="max-h-[52dvh] space-y-1.5 overflow-y-auto pr-1">
        {shown.map((p) => {
          const r = draft[p.id];
          const priceBad = r.price.trim() !== "" && !isAmount(r.price);
          const stockBad = !r.stockUnlimited && !isCount(r.stockInitial);
          return (
            <div
              key={p.id}
              className={cn(
                "flex flex-wrap items-center gap-2 rounded-control border p-2",
                r.onCarte ? "border-line bg-surface" : "border-transparent opacity-60",
              )}
            >
              <label className="flex min-h-11 min-w-0 flex-1 basis-48 cursor-pointer items-center gap-2.5">
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
              {/* Largeurs portées par un conteneur : TextInput impose `w-full`
                  et `cn` ne fusionne pas les classes, un `w-20` passé en
                  className perdait — d'où des champs de 180px. */}
              {r.onCarte && (
                <div className="ml-auto flex items-center gap-2">
                  <div className="w-24">
                    <TextInput
                      value={r.price}
                      onChange={(e) => set(p.id, { price: e.target.value })}
                      inputMode="decimal"
                      placeholder={formatAmount(p.priceCents)}
                      aria-label={`Prix de ${p.name} (vide = prix catalogue)`}
                      title="Prix (vide = prix catalogue)"
                      invalid={priceBad}
                      className="tnum min-h-11 text-right"
                    />
                  </div>
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
                  {/* Place réservée même en illimité : les colonnes restent
                      alignées d'une ligne à l'autre. */}
                  <div className="w-20">
                    {!r.stockUnlimited && (
                      <TextInput
                        value={r.stockInitial}
                        onChange={(e) => set(p.id, { stockInitial: e.target.value })}
                        inputMode="numeric"
                        aria-label={`Stock initial de ${p.name}`}
                        title="Stock initial"
                        invalid={stockBad}
                        className="tnum min-h-11 text-right"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {products.length > 0 && shown.length === 0 && (
          <p className="py-6 text-center text-body text-ash">Aucun produit ne correspond.</p>
        )}
        {products.length === 0 && (
          <p className="py-6 text-center text-body text-ash">
            Aucun produit au catalogue. Crée-en dans l'onglet Produits.
          </p>
        )}
      </div>

      {invalidCount > 0 && (
        <p role="alert" className="mt-3 text-body font-semibold text-signal">
          {invalidCount} ligne{invalidCount > 1 ? "s" : ""} avec un prix ou un stock invalide (en
          rouge).
        </p>
      )}
      <div className="mt-5 flex gap-2">
        <Button variant="ghost" size="lg" onClick={onClose}>
          Annuler
        </Button>
        <Button variant="primary" size="lg" className="flex-1" disabled={invalidCount > 0} onClick={save}>
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
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
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
                  onClick={() => setRemoving({ id: pr.id, name: pr.name })}
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
      <ConfirmModal
        open={removing !== null}
        title={`Supprimer le modèle « ${removing?.name ?? ""} » ?`}
        body="Les soirées déjà créées à partir de ce modèle ne sont pas touchées."
        confirmLabel="Supprimer"
        onConfirm={() => removing && deletePreset(removing.id)}
        onClose={() => setRemoving(null)}
      />
    </Modal>
  );
}
