import { useState } from "react";
import {
  formatAmount,
  parseAmountToCents,
  sortedProducts,
  type ClientProduct,
  type ClientStation,
  type ProductComponent,
} from "@cdf/shared";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { CaretUpIcon } from "@phosphor-icons/react/dist/csr/CaretUp";
import { MinusIcon } from "@phosphor-icons/react/dist/csr/Minus";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { EyeSlashIcon } from "@phosphor-icons/react/dist/csr/EyeSlash";

import { projection } from "../../lib/store.js";
import { deleteProduct, upsertProduct } from "../../lib/actions.js";
import { Button, Field, SelectInput, StepButton, TextInput } from "../../components/ui.js";
import { TicketBlock } from "../../components/ProductIcon.js";
import { Modal } from "../../components/Modal.js";
import { ConfirmModal } from "../../components/ConfirmModal.js";
import { cn } from "../../lib/cn.js";
import { isAmount, isCount } from "../../lib/validate.js";
import { TicketColorField, VisualPicker } from "./ProductVisual.js";

export function ProductEditor({
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
  const [imageKey, setImageKey] = useState<string | null>(product.imageKey);
  const [imageZoom, setImageZoom] = useState<number | null>(product.imageZoom);
  const [active, setActive] = useState(product.active);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [tried, setTried] = useState(false);
  // Le parent passe un produit neuf (id inédit) pour « Nouveau produit ».
  const isNew = !projection.products[product.id];

  const draft = { name, price, category, stationId, stockInitial, stockUnlimited, components, emoji, color, imageKey, imageZoom, active };
  const [initial] = useState(() => JSON.stringify(draft));
  const dirty = JSON.stringify(draft) !== initial;

  const errors = {
    name: name.trim() ? null : "Donne un nom au produit.",
    price: !isAmount(price)
      ? "Prix invalide (ex. 5 ou 5,50)."
      : parseAmountToCents(price) === 0
        ? "Un produit à 0 € : utilise plutôt « Offert » à l'encaissement."
        : null,
    stock: stockUnlimited || isCount(stockInitial) ? null : "Stock invalide (nombre entier).",
  };
  const valid = !errors.name && !errors.price && !errors.stock;

  const save = () => {
    setTried(true);
    if (!valid) return;
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
      imageKey,
      imageZoom,
    });
    onClose();
  };

  return (
    <>
      <Modal open onClose={onClose} dismissable={!dirty}>
        <h2 className="font-display mb-4 truncate text-lead font-bold text-cream">
          {isNew ? "Nouveau produit" : `Modifier « ${product.name} »`}
        </h2>
        <div className="max-h-[66dvh] space-y-4 overflow-y-auto pr-1">
          <Field label="Nom">
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              invalid={tried && !!errors.name}
            />
            {tried && errors.name && <FieldError>{errors.name}</FieldError>}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Prix (€)">
              <TextInput
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
                placeholder="5,00"
                className="tnum"
                invalid={tried && !!errors.price}
              />
              {tried && errors.price && <FieldError>{errors.price}</FieldError>}
            </Field>
            <Field label="Stock initial">
              <TextInput
                value={stockUnlimited ? "illimité" : stockInitial}
                onChange={(e) => setStockInitial(e.target.value)}
                inputMode="numeric"
                disabled={stockUnlimited}
                className={cn("tnum", stockUnlimited && "opacity-50")}
                invalid={tried && !!errors.stock}
              />
              {tried && errors.stock && <FieldError>{errors.stock}</FieldError>}
            </Field>
          </div>
          {/* Deux stocks coexistent et on les confondait : celui-ci n'est qu'une
              valeur proposée, celui de la soirée se règle dans sa carte. */}
          <p className="-mt-2 text-micro text-ash">
            Valeur proposée quand le produit est ajouté à la carte d'une soirée. Le stock d'une soirée
            en cours se règle dans Soirées → Carte, ou dans Stock.
          </p>

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

          <VisualPicker
            emoji={emoji}
            onEmojiChange={setEmoji}
            imageKey={imageKey}
            onImageChange={setImageKey}
            imageZoom={imageZoom}
            onZoomChange={setImageZoom}
            color={color}
          />

          <TicketColorField
            value={color}
            onChange={setColor}
            emoji={emoji}
            imageKey={imageKey}
            imageZoom={imageZoom}
            name={name}
          />

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

        {tried && !valid && (
          <p role="alert" className="mt-3 text-body font-semibold text-signal">
            Corrige les champs en rouge avant d'enregistrer.
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          {/* « Masquer » et non « Supprimer » : c'est ce que fait réellement
              l'action (les ventes passées gardent le produit). Absent pour un
              produit pas encore créé. Glyphe explicite : signal et lantern
              voisins convergent en deutéranopie. */}
          {!isNew && product.active && (
            <Button variant="danger" onClick={() => setConfirmRemove(true)}>
              <EyeSlashIcon size={17} weight="bold" />
              Masquer
            </Button>
          )}
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

function FieldError({ children }: { children: string }) {
  return <span className="mt-1 block text-micro font-semibold text-signal">{children}</span>;
}

/**
 * Choix du visuel : une icône OU une image.
 *
 * Exclusivité au RENDU, pas en base. `emoji` reste toujours renseigné même
 * quand une image est choisie, parce que c'est lui qui sert de repli quand
 * l'image n'est pas encore dans le cache local d'un poste hors ligne. Retirer
 * l'image restaure donc l'icône précédente au lieu de laisser le produit nu.
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
                    imageKey={p.imageKey}
                    imageZoom={p.imageZoom}
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
