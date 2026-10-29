import { useState } from "react";
import {
  soireeCarte,
  soldFromComponents,
  soldWithComponents,
  stockRemaining,
  type ClientProduct,
  type StockReason,
} from "@cdf/shared";
import { ConfettiIcon } from "@phosphor-icons/react/dist/csr/Confetti";
import { InfinityIcon } from "@phosphor-icons/react/dist/csr/Infinity";
import { MinusIcon } from "@phosphor-icons/react/dist/csr/Minus";
import { PackageIcon } from "@phosphor-icons/react/dist/csr/Package";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { ListNumbersIcon } from "@phosphor-icons/react/dist/csr/ListNumbers";

import { projection } from "../lib/store.js";
import { useActiveSoiree, useRev } from "../lib/hooks.js";
import { adjustStock } from "../lib/actions.js";
import { Button, EmptyState, StepButton, TextInput } from "../components/ui.js";
import { TicketBlock } from "../components/ProductIcon.js";
import { Modal } from "../components/Modal.js";
import { NoSoiree } from "../components/NoSoiree.js";
import { DepletionHint } from "../components/DepletionHint.js";
import { cn } from "../lib/cn.js";

/** `count` = recomptage : on saisit ce qu'il y a VRAIMENT, l'écart est calculé. */
type AdjustKind = "restock" | "spoilage" | "count";

export function InventaireScreen() {
  useRev();
  const soiree = useActiveSoiree();
  const [adjust, setAdjust] = useState<{ product: ClientProduct; kind: AdjustKind } | null>(null);

  if (!soiree) return <NoSoiree />;
  const soireeId = soiree.id;
  const rows = soireeCarte(projection, soireeId);

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col p-4">
      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
        <h1 className="font-display text-title font-bold text-cream">Inventaire</h1>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-well px-3 py-1.5 text-micro font-bold text-sand">
          <ConfettiIcon size={14} weight="fill" className="text-lantern" />
          {soiree.name}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <EmptyState
            icon={<PackageIcon size={44} weight="light" />}
            title="Aucun produit sur la carte"
            hint="Ouvre la carte de cette soirée depuis Soirées pour choisir ce qui est en vente."
          />
        ) : (
          <div className="space-y-2 pb-4">
            {rows.map(({ product: p }) => {
              const sold = soldWithComponents(projection, soireeId, p.id);
              const viaMenus = soldFromComponents(projection, soireeId, p.id);
              const adj = projection.adjustments[soireeId]?.[p.id] ?? 0;
              const remaining = stockRemaining(projection, soireeId, p.id);
              return (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center gap-3 rounded-control border border-line bg-surface p-2.5"
                >
                  <TicketBlock
                    emoji={p.emoji}
                    color={p.color}
                    imageKey={p.imageKey}
                    imageZoom={p.imageZoom}
                    iconSize={22}
                    className="h-12 w-12"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-body font-bold text-cream">{p.name}</div>
                    <div className="tnum text-micro text-sand">
                      Vendu {sold}
                      {viaMenus > 0 && ` (dont ${viaMenus} en menu)`}
                      {adj !== 0 && ` · Ajust. ${adj > 0 ? "+" : ""}${adj}`}
                    </div>
                    <DepletionHint soireeId={soireeId} productId={p.id} className="mt-0.5" />
                  </div>

                  <div className="text-right">
                    <div className="text-micro font-bold tracking-wide text-ash uppercase">
                      Restant
                    </div>
                    {remaining === null ? (
                      <div className="flex justify-end text-dusk" title="Stock illimité">
                        <InfinityIcon size={28} weight="bold" />
                      </div>
                    ) : (
                      <div
                        key={remaining}
                        className={cn(
                          "font-display tnum animate-value-in text-title leading-none font-bold",
                          remaining <= 0 ? "text-signal" : "text-cream",
                        )}
                      >
                        {remaining}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {remaining === null ? (
                      <span className="text-micro text-ash">rien à suivre</span>
                    ) : (
                      <>
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => setAdjust({ product: p, kind: "restock" })}
                        >
                          <PlusIcon size={16} weight="bold" />
                          Réappro
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setAdjust({ product: p, kind: "spoilage" })}
                        >
                          <MinusIcon size={16} weight="bold" />
                          Perte
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          aria-label={`Recompter ${p.name}`}
                          onClick={() => setAdjust({ product: p, kind: "count" })}
                        >
                          <ListNumbersIcon size={17} weight="bold" />
                          Recompter
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {adjust && (
        <AdjustModal
          product={adjust.product}
          kind={adjust.kind}
          soireeId={soireeId}
          onClose={() => setAdjust(null)}
        />
      )}
    </div>
  );
}

function AdjustModal({
  product,
  kind,
  soireeId,
  onClose,
}: {
  product: ClientProduct;
  kind: AdjustKind;
  soireeId: string;
  onClose: () => void;
}) {
  const current = stockRemaining(projection, soireeId, product.id);
  const isCount = kind === "count";
  // En recomptage, on part du stock théorique : souvent il suffit de corriger de 1 ou 2.
  const [qty, setQty] = useState(isCount ? Math.max(0, current ?? 0) : 0);
  const delta = isCount ? qty - (current ?? 0) : kind === "restock" ? qty : -qty;
  const reason: StockReason = isCount ? "correction" : kind;

  const confirm = () => {
    if (delta !== 0) void adjustStock(product.id, delta, reason, undefined, soireeId);
    onClose();
  };

  const title = { restock: "Réapprovisionnement", spoilage: "Déclarer une perte", count: "Recompter le stock" }[kind];
  const confirmLabel = isCount
    ? delta === 0
      ? "Aucun écart"
      : `Corriger à ${qty} (${delta > 0 ? "+" : "−"}${Math.abs(delta)})`
    : kind === "restock"
      ? `Ajouter ${qty}`
      : `Retirer ${qty}`;

  return (
    <Modal open onClose={onClose} dismissable={delta === 0}>
      <div className="mb-4 flex items-center gap-3">
        <TicketBlock
          emoji={product.emoji}
          color={product.color}
          imageKey={product.imageKey}
          imageZoom={product.imageZoom}
          iconSize={22}
          className="h-12 w-12"
        />
        <div className="min-w-0">
          <h2 className="font-display truncate text-lead font-bold text-cream">{title}</h2>
          <p className="tnum truncate text-body text-sand">
            {product.name} · stock {isCount ? "théorique" : "actuel"} {current ?? "illimité"}
          </p>
        </div>
      </div>

      {isCount && (
        <p className="mb-3 text-body text-sand">
          Compte ce qui reste réellement (frigo, réserve) et saisis le nombre. L'écart est enregistré
          comme une correction.
        </p>
      )}

      <div className="mb-4 flex items-center justify-center gap-5">
        <StepButton
          aria-label="Diminuer"
          className="h-16 w-16"
          onClick={() => setQty((q) => Math.max(0, q - 1))}
        >
          <MinusIcon size={26} weight="bold" />
        </StepButton>
        {isCount ? (
          <TextInput
            inputMode="numeric"
            aria-label="Quantité comptée"
            value={String(qty)}
            onChange={(e) => setQty(Math.max(0, Number(e.target.value.replace(/\D/g, "")) || 0))}
            onFocus={(e) => e.target.select()}
            className="font-display tnum w-32 text-center text-display font-bold"
          />
        ) : (
          <div className="font-display tnum w-28 text-center text-hero font-bold text-cream">{qty}</div>
        )}
        <StepButton aria-label="Augmenter" className="h-16 w-16" onClick={() => setQty((q) => q + 1)}>
          <PlusIcon size={26} weight="bold" />
        </StepButton>
      </div>

      {!isCount && (
        <div className="mb-5 grid grid-cols-4 gap-2">
          {[5, 10, 25, 50].map((n) => (
            <Button key={n} variant="secondary" size="lg" onClick={() => setQty((q) => q + n)}>
              +{n}
            </Button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="ghost" size="lg" onClick={onClose}>
          Annuler
        </Button>
        <Button
          variant={kind === "spoilage" ? "danger" : kind === "restock" ? "success" : "primary"}
          size="lg"
          className="flex-1"
          disabled={delta === 0}
          onClick={confirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
