import { useMemo, useState } from "react";
import {
  formatCents,
  sortedProducts,
  stockRemaining,
  type ClientProduct,
  type PaymentMethod,
} from "@cdf/shared";
import { projection } from "../lib/store.js";
import { useRev } from "../lib/hooks.js";
import { useCart } from "../lib/cart.js";
import { useSession } from "../lib/session.js";
import { emitSale } from "../lib/actions.js";
import { Button, Card } from "../components/ui.js";
import { Modal } from "../components/Modal.js";
import { PaymentModal } from "../components/PaymentModal.js";
import { cn } from "../lib/cn.js";

export function CaisseScreen() {
  useRev();
  const { label, cashierName } = useSession();
  const cart = useCart();
  const [category, setCategory] = useState<string>("Tous");
  const [payOpen, setPayOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const products = sortedProducts(projection).filter((p) => p.active);
  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category));
    return ["Tous", ...[...set].sort()];
  }, [products]);
  const visible = category === "Tous" ? products : products.filter((p) => p.category === category);

  const lines = Object.entries(cart.items)
    .map(([id, qty]) => ({ product: projection.products[id], qty }))
    .filter((l) => l.product);
  const totalCents = lines.reduce((s, l) => s + l.product.priceCents * l.qty, 0);
  const itemCount = lines.reduce((s, l) => s + l.qty, 0);

  const confirmPayment = (method: PaymentMethod, cashReceivedCents?: number) => {
    void emitSale({
      registerLabel: label ?? "Caisse",
      cashierName: cashierName ?? undefined,
      paymentMethod: method,
      items: lines.map((l) => ({
        productId: l.product.id,
        qty: l.qty,
        unitPriceCents: l.product.priceCents,
      })),
      totalCents,
      cashReceivedCents,
    });
    cart.clear();
    setPayOpen(false);
    setSheetOpen(false);
    setToast(`Encaissé ${formatCents(totalCents)} · ${method === "cash" ? "espèces" : "carte"}`);
    setTimeout(() => setToast(null), 2200);
  };

  return (
    <div className="flex h-full">
      {/* Zone produits */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex gap-2 overflow-x-auto border-b border-slate-800 px-3 py-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                category === c
                  ? "bg-amber-500 text-slate-950"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700",
              )}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-24 lg:pb-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {visible.map((p) => (
              <ProductTile key={p.id} product={p} qty={cart.items[p.id] ?? 0} onAdd={() => cart.add(p.id)} />
            ))}
          </div>
          {visible.length === 0 && (
            <p className="mt-10 text-center text-slate-500">Aucun produit. Configure-les dans l'admin.</p>
          )}
        </div>
      </div>

      {/* Panier — barre latérale (lg+) */}
      <aside className="hidden w-96 flex-col border-l border-slate-800 bg-slate-900/50 lg:flex">
        <CartPanel
          lines={lines}
          totalCents={totalCents}
          onInc={(id) => cart.add(id)}
          onDec={(id) => cart.add(id, -1)}
          onRemove={(id) => cart.remove(id)}
          onClear={cart.clear}
          onPay={() => setPayOpen(true)}
        />
      </aside>

      {/* Barre panier mobile (< lg) */}
      {itemCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-800 bg-slate-900/95 p-3 backdrop-blur safe-bottom lg:hidden">
          <Button variant="primary" size="lg" className="flex w-full items-center justify-between" onClick={() => setSheetOpen(true)}>
            <span>{itemCount} article{itemCount > 1 ? "s" : ""}</span>
            <span>{formatCents(totalCents)} · Voir le panier</span>
          </Button>
        </div>
      )}

      {/* Panier plein écran (mobile) */}
      <Modal open={sheetOpen} onClose={() => setSheetOpen(false)} className="max-h-[85vh] overflow-hidden p-0">
        <CartPanel
          lines={lines}
          totalCents={totalCents}
          onInc={(id) => cart.add(id)}
          onDec={(id) => cart.add(id, -1)}
          onRemove={(id) => cart.remove(id)}
          onClear={cart.clear}
          onPay={() => setPayOpen(true)}
        />
      </Modal>

      <PaymentModal
        open={payOpen}
        totalCents={totalCents}
        onClose={() => setPayOpen(false)}
        onConfirm={confirmPayment}
      />

      {toast && (
        <div className="fixed left-1/2 top-4 z-[60] -translate-x-1/2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg animate-fade-in">
          ✓ {toast}
        </div>
      )}
    </div>
  );
}

function ProductTile({
  product,
  qty,
  onAdd,
}: {
  product: ClientProduct;
  qty: number;
  onAdd: () => void;
}) {
  const stock = stockRemaining(projection, product.id);
  return (
    <button
      onClick={onAdd}
      className="relative flex flex-col items-start gap-1 rounded-2xl border border-slate-800 bg-slate-800/60 p-3 text-left transition-transform active:scale-95"
      style={{ boxShadow: `inset 3px 0 0 ${product.color}` }}
    >
      {qty > 0 && (
        <span className="absolute right-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-amber-500 px-1.5 text-sm font-black text-slate-950">
          {qty}
        </span>
      )}
      <span className="text-3xl">{product.emoji}</span>
      <span className="line-clamp-2 text-sm font-semibold text-slate-100">{product.name}</span>
      <div className="flex w-full items-center justify-between">
        <span className="font-bold text-amber-400">{formatCents(product.priceCents)}</span>
        <StockBadge stock={stock} />
      </div>
    </button>
  );
}

function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0)
    return <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-xs font-bold text-rose-300">épuisé</span>;
  const tone = stock <= 10 ? "text-amber-300" : "text-slate-400";
  return <span className={cn("text-xs font-semibold", tone)}>{stock} en stock</span>;
}

interface Line {
  product: ClientProduct;
  qty: number;
}

function CartPanel({
  lines,
  totalCents,
  onInc,
  onDec,
  onRemove,
  onClear,
  onPay,
}: {
  lines: Line[];
  totalCents: number;
  onInc: (id: string) => void;
  onDec: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onPay: () => void;
}) {
  return (
    <div className="flex h-full max-h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <h2 className="font-bold text-slate-100">Panier</h2>
        {lines.length > 0 && (
          <button onClick={onClear} className="text-xs font-semibold text-slate-400 hover:text-rose-400">
            Vider
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {lines.length === 0 ? (
          <p className="mt-10 text-center text-sm text-slate-500">Touche un produit pour l'ajouter.</p>
        ) : (
          <div className="space-y-2">
            {lines.map((l) => (
              <Card key={l.product.id} className="flex items-center gap-2 p-2">
                <span className="text-xl">{l.product.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-100">{l.product.name}</div>
                  <div className="text-xs text-slate-400">{formatCents(l.product.priceCents)}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="secondary" size="sm" className="h-8 w-8 !px-0" onClick={() => onDec(l.product.id)}>
                    −
                  </Button>
                  <span className="w-6 text-center font-bold text-slate-100">{l.qty}</span>
                  <Button variant="secondary" size="sm" className="h-8 w-8 !px-0" onClick={() => onInc(l.product.id)}>
                    +
                  </Button>
                </div>
                <div className="w-16 text-right text-sm font-bold text-amber-400">
                  {formatCents(l.product.priceCents * l.qty)}
                </div>
                <button onClick={() => onRemove(l.product.id)} className="px-1 text-slate-500 hover:text-rose-400">
                  ✕
                </button>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-slate-800 p-4 safe-bottom">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-slate-400">Total</span>
          <span className="text-3xl font-black text-slate-100">{formatCents(totalCents)}</span>
        </div>
        <Button variant="primary" size="xl" className="w-full" disabled={lines.length === 0} onClick={onPay}>
          Encaisser
        </Button>
      </div>
    </div>
  );
}
