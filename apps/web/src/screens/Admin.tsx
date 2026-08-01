import { useState } from "react";
import {
  formatAmount,
  formatCents,
  parseAmountToCents,
  sortedProducts,
  sortedStations,
  type ClientProduct,
  type ClientStation,
} from "@cdf/shared";
import { projection } from "../lib/store.js";
import { useRev } from "../lib/hooks.js";
import { newId } from "../lib/device.js";
import {
  deleteProduct,
  deleteStation,
  upsertProduct,
  upsertStation,
} from "../lib/actions.js";
import { Button, Card } from "../components/ui.js";
import { Modal } from "../components/Modal.js";
import { cn } from "../lib/cn.js";

type Tab = "produits" | "stations";

export function AdminScreen() {
  useRev();
  const [tab, setTab] = useState<Tab>("produits");
  const [editProduct, setEditProduct] = useState<ClientProduct | null>(null);
  const [editStation, setEditStation] = useState<ClientStation | null>(null);

  const products = sortedProducts(projection);
  const stations = sortedStations(projection);

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col p-4">
      <div className="mb-4 flex gap-2">
        <TabBtn active={tab === "produits"} onClick={() => setTab("produits")}>
          Produits
        </TabBtn>
        <TabBtn active={tab === "stations"} onClick={() => setTab("stations")}>
          Stations cuisine
        </TabBtn>
      </div>

      {tab === "produits" && (
        <>
          <Button
            variant="primary"
            className="mb-3 self-start"
            onClick={() =>
              setEditProduct({
                id: newId(),
                name: "",
                priceCents: 0,
                category: "Divers",
                stationId: stations[0]?.id ?? null,
                stockInitial: 0,
                active: true,
                sortOrder: products.length,
                emoji: "🍔",
                color: "#f59e0b",
              })
            }
          >
            + Nouveau produit
          </Button>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-4">
            {products.map((p) => (
              <Card
                key={p.id}
                className={cn("flex items-center gap-3 p-3", !p.active && "opacity-50")}
              >
                <span className="text-2xl" style={{ filter: !p.active ? "grayscale(1)" : undefined }}>
                  {p.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-slate-100">
                    {p.name || "(sans nom)"} {!p.active && <span className="text-xs text-rose-400">· masqué</span>}
                  </div>
                  <div className="text-xs text-slate-400">
                    {formatCents(p.priceCents)} · {p.category}
                    {p.stationId && ` · ${projection.stations[p.stationId]?.name ?? p.stationId}`} · stock {p.stockInitial}
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setEditProduct(p)}>
                  Modifier
                </Button>
              </Card>
            ))}
          </div>
        </>
      )}

      {tab === "stations" && (
        <>
          <Button
            variant="primary"
            className="mb-3 self-start"
            onClick={() => setEditStation({ id: newId(), name: "", sortOrder: stations.length })}
          >
            + Nouvelle station
          </Button>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-4">
            {stations.map((s) => (
              <Card key={s.id} className="flex items-center gap-3 p-3">
                <span className="text-2xl">👨‍🍳</span>
                <div className="flex-1 font-semibold text-slate-100">{s.name}</div>
                <Button variant="secondary" size="sm" onClick={() => setEditStation(s)}>
                  Modifier
                </Button>
              </Card>
            ))}
            {stations.length === 0 && (
              <p className="text-center text-sm text-slate-500">Aucune station. Crée « Grill », « Friteuse »…</p>
            )}
          </div>
        </>
      )}

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

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
        active ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-300 hover:bg-slate-700",
      )}
    >
      {children}
    </button>
  );
}

const EMOJIS = ["🍔", "🧀", "🌭", "🍟", "🥤", "💧", "🍺", "☕", "🥞", "🍰", "🌮", "🍕", "🥗", "🍦"];

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
  const [emoji, setEmoji] = useState(product.emoji);
  const [color, setColor] = useState(product.color);
  const [active, setActive] = useState(product.active);

  const save = () => {
    void upsertProduct({
      id: product.id,
      name: name.trim() || "Produit",
      priceCents: parseAmountToCents(price),
      category: category.trim() || "Divers",
      stationId: stationId || null,
      stockInitial: Number(stockInitial) || 0,
      active,
      sortOrder: product.sortOrder,
      emoji,
      color,
    });
    onClose();
  };

  const remove = () => {
    if (confirm(`Masquer « ${name} » ? Il disparaîtra de la caisse.`)) {
      void deleteProduct(product.id);
      onClose();
    }
  };

  return (
    <Modal open onClose={onClose}>
      <h2 className="mb-4 text-lg font-bold text-slate-100">Produit</h2>
      <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
        <L label="Nom">
          <Input value={name} onChange={setName} autoFocus />
        </L>
        <div className="grid grid-cols-2 gap-3">
          <L label="Prix (€)">
            <Input value={price} onChange={setPrice} inputMode="decimal" placeholder="5,00" />
          </L>
          <L label="Stock initial">
            <Input value={stockInitial} onChange={setStockInitial} inputMode="numeric" />
          </L>
        </div>
        <L label="Catégorie">
          <Input value={category} onChange={setCategory} placeholder="Plats, Boissons…" />
        </L>
        <L label="Station cuisine">
          <select
            value={stationId}
            onChange={(e) => setStationId(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-slate-100 outline-none focus:border-amber-400"
          >
            <option value="">— Aucune —</option>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </L>
        <L label="Icône">
          <div className="flex flex-wrap gap-1.5">
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={cn(
                  "h-10 w-10 rounded-lg text-xl",
                  emoji === e ? "bg-amber-500/30 ring-2 ring-amber-400" : "bg-slate-800",
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </L>
        <div className="flex items-center gap-4">
          <L label="Couleur">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-16 rounded-lg border border-slate-700 bg-slate-800"
            />
          </L>
          <label className="flex items-center gap-2 pt-5 text-sm text-slate-300">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-5 w-5" />
            Visible en caisse
          </label>
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        <Button variant="danger" onClick={remove}>
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
  );
}

function StationEditor({ station, onClose }: { station: ClientStation; onClose: () => void }) {
  const [name, setName] = useState(station.name);
  const save = () => {
    void upsertStation({ id: station.id, name: name.trim() || "Station", sortOrder: station.sortOrder });
    onClose();
  };
  const remove = () => {
    if (confirm(`Supprimer la station « ${name} » ?`)) {
      void deleteStation(station.id);
      onClose();
    }
  };
  return (
    <Modal open onClose={onClose}>
      <h2 className="mb-4 text-lg font-bold text-slate-100">Station cuisine</h2>
      <L label="Nom">
        <Input value={name} onChange={setName} autoFocus />
      </L>
      <div className="mt-5 flex gap-2">
        <Button variant="danger" onClick={remove}>
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
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  ...props
}: {
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-slate-100 outline-none focus:border-amber-400"
      {...props}
    />
  );
}
