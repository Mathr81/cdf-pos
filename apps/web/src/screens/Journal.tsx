import { useMemo, useState } from "react";
import {
  effectivePrice,
  formatCents,
  soireeCarte,
  soireeOrders,
  sortedSoirees,
  type ClientOrder,
  type PaymentMethod,
} from "@cdf/shared";
import { projection } from "../lib/store.js";
import { useActiveSoiree, useRev } from "../lib/hooks.js";
import { amendOrder, voidOrder } from "../lib/actions.js";
import { Badge, Button } from "../components/ui.js";
import { Modal } from "../components/Modal.js";
import { cn } from "../lib/cn.js";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function JournalScreen() {
  useRev();
  const active = useActiveSoiree();
  const soirees = sortedSoirees(projection);
  const [soireeId, setSoireeId] = useState<string>(active?.id ?? soirees[0]?.id ?? "");
  const [q, setQ] = useState("");
  const [pay, setPay] = useState<"all" | PaymentMethod>("all");
  const [status, setStatus] = useState<"all" | "paid" | "void">("all");
  const [detail, setDetail] = useState<ClientOrder | null>(null);
  const [editing, setEditing] = useState<ClientOrder | null>(null);

  const orders = useMemo(() => {
    if (!soireeId) return [];
    let list = soireeOrders(projection, soireeId).slice().reverse();
    if (pay !== "all") list = list.filter((o) => o.paymentMethod === pay);
    if (status !== "all") list = list.filter((o) => o.status === status);
    if (q.trim()) {
      const needle = q.toLowerCase();
      list = list.filter(
        (o) =>
          o.registerLabel.toLowerCase().includes(needle) ||
          (o.cashierName ?? "").toLowerCase().includes(needle) ||
          o.items.some((i) => (projection.products[i.productId]?.name ?? "").toLowerCase().includes(needle)),
      );
    }
    return list;
  }, [soireeId, pay, status, q, useRev()]); // eslint-disable-line react-hooks/exhaustive-deps

  const revenue = orders.filter((o) => o.status === "paid").reduce((s, o) => s + o.totalCents, 0);

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col p-4">
      <h1 className="mb-3 text-xl font-bold text-slate-100">Journal des transactions</h1>

      <div className="mb-3 flex flex-wrap gap-2">
        <select value={soireeId} onChange={(e) => setSoireeId(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100">
          {soirees.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.date})
            </option>
          ))}
        </select>
        <select value={pay} onChange={(e) => setPay(e.target.value as typeof pay)} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100">
          <option value="all">Tous paiements</option>
          <option value="cash">Espèces</option>
          <option value="card">Carte</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100">
          <option value="all">Tous statuts</option>
          <option value="paid">Payées</option>
          <option value="void">Annulées</option>
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher…"
          className="min-w-32 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-400"
        />
      </div>

      <div className="mb-2 text-xs text-slate-400">
        {orders.length} transaction{orders.length > 1 ? "s" : ""} · CA payé {formatCents(revenue)}
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pb-4">
        {orders.map((o) => (
          <button
            key={o.id}
            onClick={() => setDetail(o)}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-left transition-colors hover:bg-slate-800/60",
              o.status === "void" && "opacity-50",
            )}
          >
            <div className="text-sm tabular-nums text-slate-400">{fmtTime(o.createdAt)}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-slate-100">
                {o.registerLabel}
                {o.cashierName && <span className="text-slate-400"> · {o.cashierName}</span>}
              </div>
              <div className="truncate text-xs text-slate-500">
                {o.items.reduce((s, i) => s + i.qty, 0)} article(s) · {o.paymentMethod === "cash" ? "espèces" : "carte"}
              </div>
            </div>
            {o.amended && <Badge tone="amber">modifiée</Badge>}
            {o.status === "void" && <Badge tone="rose">annulée</Badge>}
            <div className={cn("w-20 text-right font-bold", o.status === "void" ? "text-slate-500 line-through" : "text-amber-400")}>
              {formatCents(o.totalCents)}
            </div>
          </button>
        ))}
        {orders.length === 0 && <p className="mt-10 text-center text-slate-500">Aucune transaction.</p>}
      </div>

      {detail && (
        <OrderDetail
          order={detail}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setEditing(detail);
            setDetail(null);
          }}
        />
      )}
      {editing && <AmendModal order={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function OrderDetail({
  order,
  onClose,
  onEdit,
}: {
  order: ClientOrder;
  onClose: () => void;
  onEdit: () => void;
}) {
  const doVoid = () => {
    if (confirm("Annuler cette commande ? Elle sera retirée du chiffre d'affaires.")) {
      void voidOrder(order.id);
      onClose();
    }
  };
  return (
    <Modal open onClose={onClose}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-100">Ticket</h2>
        <span className="text-sm text-slate-400">{new Date(order.createdAt).toLocaleString("fr-FR")}</span>
      </div>
      <div className="mb-3 text-xs text-slate-400">
        {order.registerLabel}
        {order.cashierName && ` · ${order.cashierName}`} · {order.paymentMethod === "cash" ? "espèces" : "carte"}
        {order.status === "void" && " · ANNULÉE"}
        {order.amended && " · modifiée"}
      </div>
      <div className="space-y-1 border-y border-slate-800 py-2">
        {order.items.map((it, idx) => (
          <div key={idx} className="flex items-center justify-between text-sm">
            <span className="text-slate-200">
              {it.qty}× {projection.products[it.productId]?.name ?? it.productId}
            </span>
            <span className="tabular-nums text-slate-400">{formatCents(it.qty * it.unitPriceCents)}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-slate-400">Total</span>
        <span className="text-2xl font-black text-amber-400">{formatCents(order.totalCents)}</span>
      </div>
      {order.paymentMethod === "cash" && order.cashReceivedCents != null && (
        <div className="mt-1 text-right text-xs text-slate-500">
          Reçu {formatCents(order.cashReceivedCents)} · rendu {formatCents(Math.max(0, order.cashReceivedCents - order.totalCents))}
        </div>
      )}
      {order.status !== "void" && (
        <div className="mt-5 flex gap-2">
          <Button variant="danger" onClick={doVoid}>
            Annuler
          </Button>
          <div className="flex-1" />
          <Button variant="secondary" onClick={onEdit}>
            Modifier
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Fermer
          </Button>
        </div>
      )}
    </Modal>
  );
}

function AmendModal({ order, onClose }: { order: ClientOrder; onClose: () => void }) {
  useRev();
  // Lignes éditables : on part des lignes existantes.
  const [qtys, setQtys] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const it of order.items) m[it.productId] = it.qty;
    return m;
  });
  const [method, setMethod] = useState<PaymentMethod>(order.paymentMethod);

  const priceOf = (productId: string): number => {
    const existing = order.items.find((i) => i.productId === productId);
    if (existing) return existing.unitPriceCents;
    return effectivePrice(projection, order.soireeId, productId);
  };

  const carte = soireeCarte(projection, order.soireeId);
  const setQty = (id: string, qty: number) => setQtys((m) => ({ ...m, [id]: Math.max(0, qty) }));

  const lines = Object.entries(qtys)
    .filter(([, q]) => q > 0)
    .map(([productId, qty]) => ({ productId, qty, unitPriceCents: priceOf(productId) }));
  const totalCents = lines.reduce((s, l) => s + l.qty * l.unitPriceCents, 0);

  const save = () => {
    if (lines.length === 0) {
      alert("Une commande doit contenir au moins un article (sinon, annule-la).");
      return;
    }
    void amendOrder({ orderId: order.id, items: lines, totalCents, paymentMethod: method });
    onClose();
  };

  // Produits proposables : ceux déjà dans la commande + ceux de la carte.
  const proposable = new Map<string, string>();
  for (const it of order.items) proposable.set(it.productId, projection.products[it.productId]?.name ?? it.productId);
  for (const e of carte) proposable.set(e.product.id, e.product.name);

  return (
    <Modal open onClose={onClose}>
      <h2 className="mb-3 text-lg font-bold text-slate-100">Modifier la commande</h2>
      <div className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">
        {[...proposable.entries()].map(([id, name]) => {
          const q = qtys[id] ?? 0;
          return (
            <div key={id} className={cn("flex items-center gap-2 rounded-lg p-1.5", q > 0 ? "bg-slate-800/60" : "")}>
              <span className="text-lg">{projection.products[id]?.emoji ?? "•"}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-slate-100">{name}</div>
                <div className="text-xs text-slate-500">{formatCents(priceOf(id))}</div>
              </div>
              <Button variant="secondary" size="sm" className="h-8 w-8 !px-0" onClick={() => setQty(id, q - 1)}>
                −
              </Button>
              <span className="w-6 text-center font-bold text-slate-100">{q}</span>
              <Button variant="secondary" size="sm" className="h-8 w-8 !px-0" onClick={() => setQty(id, q + 1)}>
                +
              </Button>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="text-sm text-slate-400">Paiement</span>
        <Button variant={method === "cash" ? "primary" : "secondary"} size="sm" onClick={() => setMethod("cash")}>
          Espèces
        </Button>
        <Button variant={method === "card" ? "primary" : "secondary"} size="sm" onClick={() => setMethod("card")}>
          Carte
        </Button>
        <div className="ml-auto text-2xl font-black text-amber-400">{formatCents(totalCents)}</div>
      </div>

      <div className="mt-4 flex gap-2">
        <Button variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button variant="primary" size="lg" className="flex-1" onClick={save}>
          Enregistrer les modifications
        </Button>
      </div>
    </Modal>
  );
}
