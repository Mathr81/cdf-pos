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
import { CoinsIcon } from "@phosphor-icons/react/dist/csr/Coins";
import { CreditCardIcon } from "@phosphor-icons/react/dist/csr/CreditCard";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { MinusIcon } from "@phosphor-icons/react/dist/csr/Minus";
import { NotebookIcon } from "@phosphor-icons/react/dist/csr/Notebook";
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/csr/PencilSimple";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { ProhibitIcon } from "@phosphor-icons/react/dist/csr/Prohibit";

import { projection } from "../lib/store.js";
import { useActiveSoiree, useRev } from "../lib/hooks.js";
import { amendOrder, voidOrder } from "../lib/actions.js";
import {
  Badge,
  Button,
  EmptyState,
  SelectInput,
  StepButton,
  TextInput,
} from "../components/ui.js";
import { TicketBlock } from "../components/ProductIcon.js";
import { Modal } from "../components/Modal.js";
import { ConfirmModal } from "../components/ConfirmModal.js";
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
          o.items.some((i) =>
            (projection.products[i.productId]?.name ?? "").toLowerCase().includes(needle),
          ),
      );
    }
    return list;
  }, [soireeId, pay, status, q, useRev()]); // eslint-disable-line react-hooks/exhaustive-deps

  const revenue = orders.filter((o) => o.status === "paid").reduce((s, o) => s + o.totalCents, 0);

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col p-4">
      <h1 className="font-display mb-3 shrink-0 text-title font-bold text-cream">
        Journal des transactions
      </h1>

      <div className="mb-3 flex shrink-0 flex-wrap gap-2">
        <SelectInput value={soireeId} onChange={(e) => setSoireeId(e.target.value)}>
          {soirees.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.date})
            </option>
          ))}
        </SelectInput>
        <SelectInput value={pay} onChange={(e) => setPay(e.target.value as typeof pay)}>
          <option value="all">Tous paiements</option>
          <option value="cash">Espèces</option>
          <option value="card">Carte</option>
        </SelectInput>
        <SelectInput value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="all">Tous statuts</option>
          <option value="paid">Payées</option>
          <option value="void">Annulées</option>
        </SelectInput>
        <div className="relative min-w-40 flex-1">
          <MagnifyingGlassIcon
            size={17}
            weight="bold"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ash"
          />
          <TextInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher"
            aria-label="Rechercher une transaction"
            className="pl-9"
          />
        </div>
      </div>

      <div className="tnum mb-2 shrink-0 text-micro text-sand">
        {orders.length} transaction{orders.length > 1 ? "s" : ""} · CA payé{" "}
        <b className="text-cream">{formatCents(revenue)}</b>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        {orders.length === 0 ? (
          <EmptyState
            icon={<NotebookIcon size={44} weight="light" />}
            title="Aucune transaction"
            hint="Les ventes encaissées apparaîtront ici, les plus récentes en premier."
          />
        ) : (
          <div className="divide-y divide-line">
            {orders.map((o) => {
              const voided = o.status === "void";
              return (
                <button
                  key={o.id}
                  onClick={() => setDetail(o)}
                  className="flex w-full items-center gap-3 px-1 py-3 text-left transition-colors hover:bg-surface"
                >
                  <div className="tnum shrink-0 text-body text-ash">{fmtTime(o.createdAt)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-body font-bold text-cream">
                      {o.registerLabel}
                      {o.cashierName && <span className="text-sand"> · {o.cashierName}</span>}
                    </div>
                    <div className="tnum flex items-center gap-1.5 text-micro text-ash">
                      {o.paymentMethod === "cash" ? (
                        <CoinsIcon size={13} weight="fill" />
                      ) : (
                        <CreditCardIcon size={13} weight="fill" />
                      )}
                      {o.items.reduce((s, i) => s + i.qty, 0)} article(s)
                    </div>
                  </div>
                  {/* Glyphes distincts : en deutéranopie, lantern et signal
                      convergent (ΔE00 ≈ 11). La forme porte l'information. */}
                  {o.amended && (
                    <Badge tone="lantern">
                      <PencilSimpleIcon size={12} weight="bold" />
                      modifiée
                    </Badge>
                  )}
                  {voided && (
                    <Badge tone="signal">
                      <ProhibitIcon size={12} weight="bold" />
                      annulée
                    </Badge>
                  )}
                  <div
                    className={cn(
                      "tnum w-20 text-right text-body font-bold",
                      voided ? "text-ash line-through" : "text-cream",
                    )}
                  >
                    {formatCents(o.totalCents)}
                  </div>
                </button>
              );
            })}
          </div>
        )}
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
  const [confirmVoid, setConfirmVoid] = useState(false);

  return (
    <>
      <Modal open onClose={onClose}>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lead font-bold text-cream">Ticket</h2>
          <span className="tnum text-body text-sand">
            {new Date(order.createdAt).toLocaleString("fr-FR")}
          </span>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-micro text-sand">
          <span>{order.registerLabel}</span>
          {order.cashierName && <span>· {order.cashierName}</span>}
          <span>· {order.paymentMethod === "cash" ? "espèces" : "carte"}</span>
          {order.status === "void" && (
            <Badge tone="signal">
              <ProhibitIcon size={12} weight="bold" />
              annulée
            </Badge>
          )}
          {order.amended && (
            <Badge tone="lantern">
              <PencilSimpleIcon size={12} weight="bold" />
              modifiée
            </Badge>
          )}
        </div>

        <div className="divide-y divide-line border-y border-line">
          {order.items.map((it, idx) => (
            <div key={idx} className="flex items-center justify-between gap-3 py-2 text-body">
              <span className="tnum min-w-0 truncate text-cream">
                {it.qty}× {projection.products[it.productId]?.name ?? it.productId}
              </span>
              <span className="tnum shrink-0 text-sand">
                {formatCents(it.qty * it.unitPriceCents)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-baseline justify-between">
          <span className="text-body text-sand">Total</span>
          <span className="font-display tnum text-display font-bold text-lantern">
            {formatCents(order.totalCents)}
          </span>
        </div>
        {order.paymentMethod === "cash" && order.cashReceivedCents != null && (
          <div className="tnum mt-1 text-right text-micro text-ash">
            Reçu {formatCents(order.cashReceivedCents)} · rendu{" "}
            {formatCents(Math.max(0, order.cashReceivedCents - order.totalCents))}
          </div>
        )}

        {order.status !== "void" && (
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="danger" onClick={() => setConfirmVoid(true)}>
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

      <ConfirmModal
        open={confirmVoid}
        title="Annuler cette commande ?"
        body="Elle sera retirée du chiffre d'affaires sur tous les postes."
        confirmLabel="Annuler la commande"
        onConfirm={() => {
          void voidOrder(order.id);
          onClose();
        }}
        onClose={() => setConfirmVoid(false)}
      />
    </>
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
  const [error, setError] = useState<string | null>(null);

  const priceOf = (productId: string): number => {
    const existing = order.items.find((i) => i.productId === productId);
    if (existing) return existing.unitPriceCents;
    return effectivePrice(projection, order.soireeId, productId);
  };

  const carte = soireeCarte(projection, order.soireeId);
  const setQty = (id: string, qty: number) => {
    setError(null);
    setQtys((m) => ({ ...m, [id]: Math.max(0, qty) }));
  };

  const lines = Object.entries(qtys)
    .filter(([, q]) => q > 0)
    .map(([productId, qty]) => ({ productId, qty, unitPriceCents: priceOf(productId) }));
  const totalCents = lines.reduce((s, l) => s + l.qty * l.unitPriceCents, 0);

  const save = () => {
    if (lines.length === 0) {
      setError("Une commande doit contenir au moins un article. Sinon, annule-la.");
      return;
    }
    void amendOrder({ orderId: order.id, items: lines, totalCents, paymentMethod: method });
    onClose();
  };

  // Produits proposables : ceux déjà dans la commande + ceux de la carte.
  const proposable = new Map<string, string>();
  for (const it of order.items)
    proposable.set(it.productId, projection.products[it.productId]?.name ?? it.productId);
  for (const e of carte) proposable.set(e.product.id, e.product.name);

  return (
    <Modal open onClose={onClose}>
      <h2 className="font-display mb-3 text-lead font-bold text-cream">Modifier la commande</h2>

      <div className="max-h-[46vh] space-y-1.5 overflow-y-auto pr-1">
        {[...proposable.entries()].map(([id, name]) => {
          const q = qtys[id] ?? 0;
          const product = projection.products[id];
          return (
            <div
              key={id}
              className={cn(
                "flex items-center gap-2.5 rounded-control border p-1.5",
                q > 0 ? "border-lantern/50 bg-lantern/10" : "border-transparent",
              )}
            >
              {product ? (
                <TicketBlock
                  emoji={product.emoji}
                  color={product.color}
                  iconSize={16}
                  className="h-9 w-9"
                />
              ) : (
                <div className="h-9 w-9 shrink-0 rounded-control border border-line" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-body text-cream">{name}</div>
                <div className="tnum text-micro text-ash">{formatCents(priceOf(id))}</div>
              </div>
              <StepButton aria-label={`Retirer un ${name}`} onClick={() => setQty(id, q - 1)}>
                <MinusIcon size={17} weight="bold" />
              </StepButton>
              <span className="tnum w-6 text-center text-body font-bold text-cream">{q}</span>
              <StepButton aria-label={`Ajouter un ${name}`} onClick={() => setQty(id, q + 1)}>
                <PlusIcon size={17} weight="bold" />
              </StepButton>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-body text-sand">Paiement</span>
        <Button
          variant={method === "cash" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setMethod("cash")}
        >
          Espèces
        </Button>
        <Button
          variant={method === "card" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setMethod("card")}
        >
          Carte
        </Button>
        <div className="font-display tnum ml-auto text-title font-bold text-lantern">
          {formatCents(totalCents)}
        </div>
      </div>

      {error && <p className="mt-3 text-body font-semibold text-signal">{error}</p>}

      <div className="mt-4 flex gap-2">
        <Button variant="ghost" size="lg" onClick={onClose}>
          Annuler
        </Button>
        <Button variant="primary" size="lg" className="flex-1" onClick={save}>
          Enregistrer les modifications
        </Button>
      </div>
    </Modal>
  );
}
