import { useState } from "react";
import {
  sortedProducts,
  stockRemaining,
  type ClientProduct,
  type StockReason,
} from "@cdf/shared";
import { projection } from "../lib/store.js";
import { useRev } from "../lib/hooks.js";
import { adjustStock } from "../lib/actions.js";
import { Button } from "../components/ui.js";
import { Modal } from "../components/Modal.js";
import { cn } from "../lib/cn.js";

type AdjustKind = "restock" | "spoilage";

export function InventaireScreen() {
  useRev();
  const [adjust, setAdjust] = useState<{ product: ClientProduct; kind: AdjustKind } | null>(null);

  const rows = sortedProducts(projection).filter((p) => p.active);

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col p-4">
      <h1 className="mb-3 text-xl font-bold text-slate-100">Inventaire</h1>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-2">
          {rows.map((p) => {
            const sold = projection.sold[p.id] ?? 0;
            const adj = projection.adjustments[p.id] ?? 0;
            const remaining = stockRemaining(projection, p.id);
            return (
              <div
                key={p.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3"
              >
                <span className="text-2xl">{p.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-slate-100">{p.name}</div>
                  <div className="text-xs text-slate-400">
                    Initial {p.stockInitial} · Vendu {sold}
                    {adj !== 0 && ` · Ajust. ${adj > 0 ? "+" : ""}${adj}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">Restant</div>
                  <div
                    className={cn(
                      "text-2xl font-black leading-none",
                      remaining <= 0 ? "text-rose-400" : remaining <= 10 ? "text-amber-400" : "text-emerald-400",
                    )}
                  >
                    {remaining}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="success" size="sm" onClick={() => setAdjust({ product: p, kind: "restock" })}>
                    + Réappro
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => setAdjust({ product: p, kind: "spoilage" })}>
                    − Perte
                  </Button>
                </div>
              </div>
            );
          })}
          {rows.length === 0 && (
            <p className="mt-10 text-center text-slate-500">Aucun produit.</p>
          )}
        </div>
      </div>

      {adjust && (
        <AdjustModal product={adjust.product} kind={adjust.kind} onClose={() => setAdjust(null)} />
      )}
    </div>
  );
}

function AdjustModal({
  product,
  kind,
  onClose,
}: {
  product: ClientProduct;
  kind: AdjustKind;
  onClose: () => void;
}) {
  const [qty, setQty] = useState(0);
  const isRestock = kind === "restock";
  const reason: StockReason = isRestock ? "restock" : "spoilage";

  const confirm = () => {
    if (qty > 0) {
      void adjustStock(product.id, isRestock ? qty : -qty, reason);
    }
    onClose();
  };

  return (
    <Modal open onClose={onClose}>
      <h2 className="mb-1 text-lg font-bold text-slate-100">
        {isRestock ? "Réapprovisionnement" : "Déclarer une perte"}
      </h2>
      <p className="mb-4 text-sm text-slate-400">
        {product.emoji} {product.name} · stock actuel {stockRemaining(projection, product.id)}
      </p>

      <div className="mb-4 flex items-center justify-center gap-4">
        <Button variant="secondary" size="lg" className="h-14 w-14 text-2xl" onClick={() => setQty((q) => Math.max(0, q - 1))}>
          −
        </Button>
        <div className="w-24 text-center text-5xl font-black text-slate-100">{qty}</div>
        <Button variant="secondary" size="lg" className="h-14 w-14 text-2xl" onClick={() => setQty((q) => q + 1)}>
          +
        </Button>
      </div>

      <div className="mb-4 grid grid-cols-4 gap-2">
        {[5, 10, 25, 50].map((n) => (
          <Button key={n} variant="ghost" size="sm" onClick={() => setQty((q) => q + n)}>
            +{n}
          </Button>
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button
          variant={isRestock ? "success" : "danger"}
          size="lg"
          className="flex-1"
          disabled={qty <= 0}
          onClick={confirm}
        >
          {isRestock ? `Ajouter ${qty}` : `Retirer ${qty}`}
        </Button>
      </div>
    </Modal>
  );
}
