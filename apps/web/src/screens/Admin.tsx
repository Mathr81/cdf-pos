import { useState } from "react";
import {
  formatAmount,
  formatCents,
  parseAmountToCents,
  sortedProducts,
  sortedStations,
  type ClientProduct,
  type ClientStation,
  type ProductComponent,
} from "@cdf/shared";
import { BroomIcon } from "@phosphor-icons/react/dist/csr/Broom";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { CaretUpIcon } from "@phosphor-icons/react/dist/csr/CaretUp";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { ChefHatIcon } from "@phosphor-icons/react/dist/csr/ChefHat";
import { MinusIcon } from "@phosphor-icons/react/dist/csr/Minus";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { WarningIcon } from "@phosphor-icons/react/dist/csr/Warning";

import { projection } from "../lib/store.js";
import { useRev } from "../lib/hooks.js";
import { newId } from "../lib/device.js";
import { deleteProduct, deleteStation, upsertProduct, upsertStation } from "../lib/actions.js";
import { api } from "../lib/api.js";
import { wipeLocalData } from "../lib/sync.js";
import {
  Button,
  Card,
  EmptyState,
  Field,
  FieldLabel,
  SelectInput,
  StepButton,
  TextInput,
} from "../components/ui.js";
import { ProductIcon, TicketBlock } from "../components/ProductIcon.js";
import { ICON_GROUPS, isIconSlug } from "../lib/productIcons.js";
import { inkOn, ticketColor } from "../lib/ticket.js";
import { Modal } from "../components/Modal.js";
import { ConfirmModal } from "../components/ConfirmModal.js";
import { cn } from "../lib/cn.js";

type Tab = "produits" | "stations" | "reset";

export function AdminScreen() {
  useRev();
  const [tab, setTab] = useState<Tab>("produits");
  const [editProduct, setEditProduct] = useState<ClientProduct | null>(null);
  const [editStation, setEditStation] = useState<ClientStation | null>(null);

  const products = sortedProducts(projection);
  const stations = sortedStations(projection);

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col p-4">
      <div className="mb-4 flex shrink-0 gap-2 overflow-x-auto">
        <TabBtn active={tab === "produits"} onClick={() => setTab("produits")}>
          Produits
        </TabBtn>
        <TabBtn active={tab === "stations"} onClick={() => setTab("stations")}>
          Stations cuisine
        </TabBtn>
        <TabBtn active={tab === "reset"} onClick={() => setTab("reset")}>
          Remise à zéro
        </TabBtn>
      </div>

      {tab === "produits" && (
        <>
          <Button
            variant="primary"
            className="mb-3 shrink-0 self-start"
            onClick={() =>
              setEditProduct({
                id: newId(),
                name: "",
                priceCents: 0,
                category: "Divers",
                stationId: stations[0]?.id ?? null,
                stockInitial: 0,
                stockUnlimited: false,
                components: [],
                active: true,
                sortOrder: products.length,
                emoji: "hamburger",
                color: "#f59e0b",
              })
            }
          >
            <PlusIcon size={18} weight="bold" />
            Nouveau produit
          </Button>
          <div className="min-h-0 flex-1 overflow-y-auto pb-4">
            <div className="space-y-2">
              {products.map((p) => (
                <div
                  key={p.id}
                  className={cn(
                    "flex items-center gap-3 rounded-control border border-line bg-surface p-2.5",
                    !p.active && "opacity-55",
                  )}
                >
                  <TicketBlock
                    emoji={p.emoji}
                    color={p.color}
                    iconSize={22}
                    dimmed={!p.active}
                    className="h-12 w-12"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-body font-bold text-cream">
                      {p.name || "(sans nom)"}
                      {!p.active && <span className="ml-1.5 text-micro text-signal">masqué</span>}
                    </div>
                    <div className="tnum truncate text-micro text-sand">
                      {formatCents(p.priceCents)} · {p.category}
                      {p.stationId &&
                        ` · ${projection.stations[p.stationId]?.name ?? p.stationId}`}{" "}
                      · {p.stockUnlimited ? "stock illimité" : `stock ${p.stockInitial}`}
                      {p.components.length > 0 &&
                        ` · avec ${p.components
                          .map(
                            (c) =>
                              `${c.qty}× ${projection.products[c.productId]?.name ?? c.productId}`,
                          )
                          .join(", ")}`}
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => setEditProduct(p)}>
                    Modifier
                  </Button>
                </div>
              ))}
              {products.length === 0 && (
                <EmptyState
                  title="Aucun produit au catalogue"
                  hint="Crée les produits vendus par le comité. Ils resteront disponibles d'une soirée à l'autre."
                />
              )}
            </div>
          </div>
        </>
      )}

      {tab === "stations" && (
        <>
          <Button
            variant="primary"
            className="mb-3 shrink-0 self-start"
            onClick={() => setEditStation({ id: newId(), name: "", sortOrder: stations.length })}
          >
            <PlusIcon size={18} weight="bold" />
            Nouvelle station
          </Button>
          <div className="min-h-0 flex-1 overflow-y-auto pb-4">
            <div className="space-y-2">
              {stations.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-control border border-line bg-surface p-2.5"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-control border border-line bg-well text-sand">
                    <ChefHatIcon size={22} weight="fill" />
                  </div>
                  <div className="min-w-0 flex-1 truncate text-body font-bold text-cream">
                    {s.name}
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => setEditStation(s)}>
                    Modifier
                  </Button>
                </div>
              ))}
              {stations.length === 0 && (
                <EmptyState
                  icon={<ChefHatIcon size={44} weight="light" />}
                  title="Aucune station"
                  hint="Crée « Grill », « Friteuse », « Froid & desserts »… Chaque produit est ensuite rattaché à une station."
                />
              )}
            </div>
          </div>
        </>
      )}

      {tab === "reset" && <ResetPanel />}

      {editProduct && (
        <ProductEditor
          product={editProduct}
          stations={stations}
          onClose={() => setEditProduct(null)}
        />
      )}
      {editStation && <StationEditor station={editStation} onClose={() => setEditStation(null)} />}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "min-h-12 rounded-control px-4 text-body font-bold whitespace-nowrap transition-colors active:scale-[0.97]",
        active ? "bg-lantern text-night" : "border border-line bg-well text-sand hover:text-cream",
      )}
    >
      {children}
    </button>
  );
}

function ProductEditor({
  product,
  stations,
  onClose,
}: {
  product: ClientProduct;
  stations: ClientStation[];
  onClose: () => void;
}) {
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(product.priceCents ? formatAmount(product.priceCents) : "");
  const [category, setCategory] = useState(product.category);
  const [stationId, setStationId] = useState(product.stationId ?? "");
  const [stockInitial, setStockInitial] = useState(String(product.stockInitial));
  const [stockUnlimited, setStockUnlimited] = useState(product.stockUnlimited);
  const [components, setComponents] = useState<ProductComponent[]>(product.components);
  const [emoji, setEmoji] = useState(product.emoji);
  const [color, setColor] = useState(product.color);
  const [active, setActive] = useState(product.active);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const save = () => {
    void upsertProduct({
      id: product.id,
      name: name.trim() || "Produit",
      priceCents: parseAmountToCents(price),
      category: category.trim() || "Divers",
      stationId: stationId || null,
      stockInitial: stockUnlimited ? 0 : Number(stockInitial) || 0,
      stockUnlimited,
      components,
      active,
      sortOrder: product.sortOrder,
      emoji,
      color,
    });
    onClose();
  };

  return (
    <>
      <Modal open onClose={onClose}>
        <h2 className="font-display mb-4 text-lead font-bold text-cream">Produit</h2>
        <div className="max-h-[66vh] space-y-4 overflow-y-auto pr-1">
          <Field label="Nom">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Prix (€)">
              <TextInput
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
                placeholder="5,00"
                className="tnum"
              />
            </Field>
            <Field label="Stock initial">
              <TextInput
                value={stockUnlimited ? "illimité" : stockInitial}
                onChange={(e) => setStockInitial(e.target.value)}
                inputMode="numeric"
                disabled={stockUnlimited}
                className={cn("tnum", stockUnlimited && "opacity-50")}
              />
            </Field>
          </div>

          <label className="flex items-start gap-3 rounded-control border border-line bg-well p-3">
            <input
              type="checkbox"
              checked={stockUnlimited}
              onChange={(e) => setStockUnlimited(e.target.checked)}
              className="mt-0.5 h-6 w-6 shrink-0 accent-lantern"
            />
            <span className="text-body text-sand">
              <b className="text-cream">Stock illimité</b>
              <span className="mt-0.5 block text-micro text-ash">
                Pour les produits qu'on ne compte pas (frites au sac, sirop…). Jamais affiché
                « épuisé », pas d'alerte de stock bas.
              </span>
            </span>
          </label>

          <Field label="Catégorie">
            <TextInput
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Plats, Boissons…"
            />
          </Field>

          <Field label="Station cuisine">
            <SelectInput
              value={stationId}
              onChange={(e) => setStationId(e.target.value)}
              className="w-full"
            >
              <option value="">Aucune</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectInput>
          </Field>

          <ComponentsPicker
            productId={product.id}
            components={components}
            onChange={setComponents}
          />

          <IconPicker value={emoji} onChange={setEmoji} color={color} />

          <TicketColorField value={color} onChange={setColor} emoji={emoji} name={name} />

          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-body text-sand">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-6 w-6 accent-lantern"
            />
            Visible en caisse
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {/* Glyphe explicite : « Supprimer » (signal) et « Enregistrer »
              (lantern) sont deux boutons pleins voisins, et ces deux teintes
              convergent en deutéranopie. */}
          <Button variant="danger" onClick={() => setConfirmRemove(true)}>
            <TrashIcon size={17} weight="bold" />
            Supprimer
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" onClick={save}>
            Enregistrer
          </Button>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmRemove}
        title={`Masquer « ${name || "ce produit"} » ?`}
        body="Il disparaîtra de la caisse. Les ventes déjà enregistrées sont conservées."
        confirmLabel="Masquer"
        onConfirm={() => {
          void deleteProduct(product.id);
          onClose();
        }}
        onClose={() => setConfirmRemove(false)}
      />
    </>
  );
}

/**
 * Sélecteur d'icône.
 * Écrit un slug Phosphor (ex "hamburger") dans `product.emoji`, qui est un
 * `z.string()` libre : aucun champ nouveau, aucune migration. Le champ de
 * secours en bas permet de conserver ou de saisir un caractère quelconque,
 * si bien qu'une valeur existante n'est jamais détruite.
 */
function IconPicker({
  value,
  onChange,
  color,
}: {
  value: string;
  onChange: (v: string) => void;
  color: string;
}) {
  const custom = !isIconSlug(value);
  return (
    <div>
      <FieldLabel>Icône</FieldLabel>
      <div className="space-y-3 rounded-control border border-line bg-well p-3">
        {ICON_GROUPS.map((g) => (
          <div key={g.label}>
            <p className="mb-1.5 text-micro font-semibold text-ash">{g.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {g.slugs.map((slug) => (
                <button
                  key={slug}
                  type="button"
                  aria-label={slug}
                  onClick={() => onChange(slug)}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-control border transition-colors",
                    value === slug
                      ? "border-lantern bg-lantern/20 text-lantern"
                      : "border-line bg-surface text-sand hover:text-cream",
                  )}
                >
                  <ProductIcon value={slug} size={22} />
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="border-t border-line pt-3">
          <label className="flex flex-wrap items-center gap-2 text-micro text-ash">
            <span>Ou un caractère libre</span>
            <TextInput
              value={custom ? value : ""}
              onChange={(e) => onChange(e.target.value)}
              placeholder="ex : 🍔"
              aria-label="Icône personnalisée"
              className="w-24 min-h-11 text-center"
            />
            {custom && value && (
              <span className="flex items-center gap-1.5 text-sand">
                <ProductIcon value={value} size={20} color={ticketColor(color)} />
                affiché tel quel
              </span>
            )}
          </label>
        </div>
      </div>
    </div>
  );
}

/**
 * Couleur du ticket papier. Le sélecteur natif est conservé : c'est le bon
 * mécanisme. L'aperçu montre le rendu réel du bloc affiché en caisse et en
 * cuisine, icône comprise, pour que la saisie soit vérifiable sur place.
 */
function TicketColorField({
  value,
  onChange,
  emoji,
  name,
}: {
  value: string;
  onChange: (v: string) => void;
  emoji: string;
  name: string;
}) {
  const hex = ticketColor(value);
  return (
    <div>
      <FieldLabel>Couleur du ticket</FieldLabel>
      <div className="flex items-center gap-3 rounded-control border border-line bg-well p-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Couleur du ticket"
          className="h-12 w-16 shrink-0 cursor-pointer rounded-control border border-line bg-surface"
        />
        <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-control border border-line bg-surface p-2">
          <TicketBlock emoji={emoji} color={hex} iconSize={22} className="h-12 w-12" />
          <div className="min-w-0">
            <div className="truncate text-body font-bold text-cream">{name || "Aperçu"}</div>
            <div className="text-micro text-ash">
              Encre {inkOn(hex) === "#14100f" ? "sombre" : "claire"}, choisie automatiquement
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Choix des produits contenus dans un plat. « Burger Frites » contient
 * 1 « Frites » → la friteuse compte cette barquette, et le stock des frites
 * est décrémenté, même si personne n'achète de frites seules.
 */
function ComponentsPicker({
  productId,
  components,
  onChange,
}: {
  productId: string;
  components: ProductComponent[];
  onChange: (next: ProductComponent[]) => void;
}) {
  const [open, setOpen] = useState(components.length > 0);
  const candidates = sortedProducts(projection).filter(
    (p) => p.id !== productId && p.active && p.components.length === 0,
  );

  const qtyOf = (id: string) => components.find((c) => c.productId === id)?.qty ?? 0;

  const setQty = (id: string, qty: number) => {
    const next = components.filter((c) => c.productId !== id);
    if (qty > 0) next.push({ productId: id, qty });
    onChange(next);
  };

  return (
    <div className="rounded-control border border-line bg-well">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-12 w-full items-center gap-2 px-3 text-left"
      >
        <span className="text-micro font-bold tracking-wide text-ash uppercase">Contient</span>
        <span className="min-w-0 flex-1 truncate text-body text-sand">
          {components.length === 0
            ? "rien"
            : components
                .map((c) => `${c.qty}× ${projection.products[c.productId]?.name ?? c.productId}`)
                .join(", ")}
        </span>
        <span className="shrink-0 text-ash">
          {open ? <CaretUpIcon size={16} weight="bold" /> : <CaretDownIcon size={16} weight="bold" />}
        </span>
      </button>

      {open && (
        <div className="border-t border-line p-2">
          <p className="mb-2 px-1 text-micro text-ash">
            Ex. « Saucisse Frites » contient 1 « Frites » : la cuisine voit alors toutes les
            barquettes à sortir, menus compris.
          </p>
          {candidates.length === 0 && (
            <p className="px-1 py-2 text-micro text-ash">Aucun autre produit disponible.</p>
          )}
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {candidates.map((p) => {
              const qty = qtyOf(p.id);
              return (
                <div
                  key={p.id}
                  className={cn(
                    "flex items-center gap-2.5 rounded-control border px-2 py-1.5",
                    qty > 0 ? "border-lantern/50 bg-lantern/10" : "border-transparent",
                  )}
                >
                  <TicketBlock
                    emoji={p.emoji}
                    color={p.color}
                    iconSize={15}
                    className="h-8 w-8"
                  />
                  <span className="min-w-0 flex-1 truncate text-body text-cream">{p.name}</span>
                  <StepButton
                    aria-label={`Retirer un ${p.name}`}
                    onClick={() => setQty(p.id, Math.max(0, qty - 1))}
                  >
                    <MinusIcon size={17} weight="bold" />
                  </StepButton>
                  <span className="tnum w-6 text-center text-body font-bold text-cream">{qty}</span>
                  <StepButton
                    aria-label={`Ajouter un ${p.name}`}
                    onClick={() => setQty(p.id, qty + 1)}
                  >
                    <PlusIcon size={17} weight="bold" />
                  </StepButton>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StationEditor({ station, onClose }: { station: ClientStation; onClose: () => void }) {
  const [name, setName] = useState(station.name);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const save = () => {
    void upsertStation({
      id: station.id,
      name: name.trim() || "Station",
      sortOrder: station.sortOrder,
    });
    onClose();
  };

  return (
    <>
      <Modal open onClose={onClose}>
        <h2 className="font-display mb-4 text-lead font-bold text-cream">Station cuisine</h2>
        <Field label="Nom">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <div className="mt-5 flex flex-wrap gap-2">
          {/* Glyphe explicite : « Supprimer » (signal) et « Enregistrer »
              (lantern) sont deux boutons pleins voisins, et ces deux teintes
              convergent en deutéranopie. */}
          <Button variant="danger" onClick={() => setConfirmRemove(true)}>
            <TrashIcon size={17} weight="bold" />
            Supprimer
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" onClick={save}>
            Enregistrer
          </Button>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmRemove}
        title={`Supprimer la station « ${name || "sans nom"} » ?`}
        body="Les produits rattachés à cette station n'apparaîtront plus dans aucun poste cuisine."
        confirmLabel="Supprimer"
        onConfirm={() => {
          void deleteStation(station.id);
          onClose();
        }}
        onClose={() => setConfirmRemove(false)}
      />
    </>
  );
}

/**
 * Remise à zéro. Le journal d'événements étant répliqué sur chaque appareil,
 * le serveur change son `epoch` : tous les postes connectés purgent alors leur
 * copie locale et se rechargent automatiquement.
 */
function ResetPanel() {
  const [pending, setPending] = useState<"sales" | "all" | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);

  const run = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.reset(pending);
      setDone(
        pending === "sales"
          ? `Ventes effacées. ${res.keptProducts} produits conservés.`
          : "Tout a été effacé (ventes et carte).",
      );
      setPending(null);
      setTyped("");
      // Le serveur diffuse « server:reset » : cet appareil aussi se purge et
      // se recharge. On force le passage au cas où le socket serait coupé.
      await wipeLocalData();
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const expected = pending === "all" ? "TOUT EFFACER" : "EFFACER";

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-4">
      {/* C'est l'écran le plus dangereux de l'app : il reçoit désormais
          l'emphase correspondante, au lieu d'une bordure imperceptible. */}
      <Card tone="danger" className="p-4">
        <h2 className="font-display flex items-center gap-2 text-lead font-bold text-signal">
          <WarningIcon size={20} weight="fill" />
          Effacer les ventes
        </h2>
        <p className="mt-2 text-body text-sand">
          Supprime les commandes, les mouvements de stock et les préparations sur tous les
          appareils. <b className="text-cream">Les produits et stations sont conservés.</b> C'est le
          bon choix après une soirée de test.
        </p>
        <Button variant="danger" size="lg" className="mt-3" onClick={() => setPending("sales")}>
          Effacer les ventes
        </Button>
      </Card>

      <Card tone="danger" className="p-4">
        <h2 className="font-display flex items-center gap-2 text-lead font-bold text-signal">
          <WarningIcon size={20} weight="fill" />
          Tout effacer
        </h2>
        <p className="mt-2 text-body text-sand">
          Supprime aussi la carte (produits et stations). L'application repart totalement vide : à
          utiliser si tu veux tout ressaisir toi-même.
        </p>
        <Button variant="danger" size="lg" className="mt-3" onClick={() => setPending("all")}>
          Tout effacer
        </Button>
      </Card>

      <Card className="p-4">
        <h2 className="font-display flex items-center gap-2 text-lead font-bold text-cream">
          <BroomIcon size={20} weight="fill" className="text-sand" />
          Vider seulement cet appareil
        </h2>
        <p className="mt-2 text-body text-sand">
          Ne touche pas au serveur : efface le cache local de cette tablette puis recharge. Utile si
          un poste affiche des données incohérentes.
        </p>
        <Button variant="secondary" size="lg" className="mt-3" onClick={() => setConfirmWipe(true)}>
          Vider le cache local
        </Button>
      </Card>

      <p className="px-1 text-micro text-ash">
        Une remise à zéro est définitive côté application. Les dumps PostgreSQL et le miroir Google
        Sheet, eux, gardent la trace de ce qui a été effacé.
      </p>

      {done && (
        <p className="flex items-center gap-2 rounded-control border border-mint bg-mint/10 p-3 text-body font-semibold text-mint">
          <CheckCircleIcon size={18} weight="fill" />
          {done} Rechargement…
        </p>
      )}

      <ConfirmModal
        open={confirmWipe}
        title="Vider les données locales ?"
        body="Le cache de cette tablette est effacé, puis la page se recharge. Le serveur n'est pas touché."
        confirmLabel="Vider et recharger"
        tone="primary"
        onConfirm={() => {
          void (async () => {
            await wipeLocalData();
            window.location.reload();
          })();
        }}
        onClose={() => setConfirmWipe(false)}
      />

      <Modal open={pending !== null} onClose={() => setPending(null)}>
        <h2 className="font-display flex items-center gap-2 text-lead font-bold text-signal">
          <WarningIcon size={20} weight="fill" />
          {pending === "all" ? "Tout effacer ?" : "Effacer les ventes ?"}
        </h2>
        <p className="mt-2 mb-4 text-body text-sand">
          Cette action est <b className="text-cream">irréversible</b> et s'applique à tous les
          appareils. Tape <b className="text-cream">{expected}</b> pour confirmer.
        </p>
        <TextInput
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoFocus
          placeholder={expected}
          aria-label="Confirmation par saisie"
        />
        {error && <p className="mt-2 text-body font-semibold text-signal">{error}</p>}
        <div className="mt-5 flex gap-2">
          <Button variant="ghost" size="lg" onClick={() => setPending(null)}>
            Annuler
          </Button>
          <div className="flex-1" />
          <Button
            variant="danger"
            size="lg"
            disabled={typed.trim() !== expected || busy}
            onClick={run}
          >
            {busy ? "Effacement…" : "Confirmer"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
