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
import { projection } from "../lib/store.js";
import { useRev } from "../lib/hooks.js";
import { newId } from "../lib/device.js";
import {
  deleteProduct,
  deleteStation,
  upsertProduct,
  upsertStation,
} from "../lib/actions.js";
import { api } from "../lib/api.js";
import { wipeLocalData } from "../lib/sync.js";
import { Button, Card } from "../components/ui.js";
import { Modal } from "../components/Modal.js";
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
      <div className="mb-4 flex gap-2">
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
            className="mb-3 self-start"
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
                    {p.stationId && ` · ${projection.stations[p.stationId]?.name ?? p.stationId}`} ·{" "}
                    {p.stockUnlimited ? "stock ∞" : `stock ${p.stockInitial}`}
                    {p.components.length > 0 &&
                      ` · avec ${p.components
                        .map((c) => `${c.qty}× ${projection.products[c.productId]?.name ?? c.productId}`)
                        .join(", ")}`}
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

const EMOJIS = [
  "🍔", "🧀", "🌭", "🍟", "🧅", "🍗", "🥓", "🌮", "🍕", "🥗",
  "🍦", "🍮", "🧊", "🍰", "🥞", "🍫", "🥤", "💧", "🍺", "☕",
];

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
            <Input
              value={stockUnlimited ? "∞" : stockInitial}
              onChange={setStockInitial}
              inputMode="numeric"
              disabled={stockUnlimited}
              className={cn(stockUnlimited && "opacity-50")}
            />
          </L>
        </div>
        <label className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-800/50 p-3">
          <input
            type="checkbox"
            checked={stockUnlimited}
            onChange={(e) => setStockUnlimited(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0"
          />
          <span className="text-sm text-slate-300">
            <b className="text-slate-100">Stock illimité</b>
            <span className="mt-0.5 block text-xs text-slate-400">
              Pour les produits qu'on ne compte pas (frites au sac, sirop…). Jamais affiché
              « épuisé », pas d'alerte de stock bas.
            </span>
          </span>
        </label>
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
        <ComponentsPicker
          productId={product.id}
          components={components}
          onChange={setComponents}
        />
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
    <div className="rounded-xl border border-slate-700 bg-slate-800/50">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Contient
        </span>
        <span className="text-sm text-slate-300">
          {components.length === 0
            ? "rien"
            : components
                .map((c) => `${c.qty}× ${projection.products[c.productId]?.name ?? c.productId}`)
                .join(", ")}
        </span>
        <span className="ml-auto text-slate-500">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-slate-700 p-2">
          <p className="mb-2 px-1 text-xs text-slate-400">
            Ex. « Saucisse Frites » contient 1 « Frites » : la cuisine voit alors toutes les
            barquettes à sortir, menus compris.
          </p>
          {candidates.length === 0 && (
            <p className="px-1 py-2 text-xs text-slate-500">Aucun autre produit disponible.</p>
          )}
          <div className="max-h-52 space-y-1 overflow-y-auto">
            {candidates.map((p) => {
              const qty = qtyOf(p.id);
              return (
                <div
                  key={p.id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2 py-1.5",
                    qty > 0 ? "bg-amber-500/15" : "bg-slate-800/60",
                  )}
                >
                  <span>{p.emoji}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{p.name}</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 w-8 !px-0"
                    onClick={() => setQty(p.id, Math.max(0, qty - 1))}
                  >
                    −
                  </Button>
                  <span className="w-6 text-center text-sm font-bold text-slate-100">{qty}</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 w-8 !px-0"
                    onClick={() => setQty(p.id, qty + 1)}
                  >
                    +
                  </Button>
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

/**
 * Remise à zéro. Le journal d'événements étant répliqué sur chaque appareil,
 * le serveur change son `epoch` : tous les postes connectés purgent alors leur
 * copie locale et se rechargent automatiquement.
 */
function ResetPanel() {
  const [confirm, setConfirm] = useState<"sales" | "all" | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const run = async () => {
    if (!confirm) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.reset(confirm);
      setDone(
        confirm === "sales"
          ? `Ventes effacées. ${res.keptProducts} produits conservés.`
          : "Tout a été effacé (ventes et carte).",
      );
      setConfirm(null);
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

  const expected = confirm === "all" ? "TOUT EFFACER" : "EFFACER";

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-4">
      <Card className="border-slate-700 p-4">
        <h2 className="font-bold text-slate-100">Effacer les ventes</h2>
        <p className="mt-1 text-sm text-slate-400">
          Supprime les commandes, les mouvements de stock et les préparations sur tous les
          appareils. <b className="text-slate-200">Les produits et stations sont conservés</b> —
          c'est le bon choix après une soirée de test.
        </p>
        <Button variant="danger" className="mt-3" onClick={() => setConfirm("sales")}>
          Effacer les ventes
        </Button>
      </Card>

      <Card className="border-rose-900/60 p-4">
        <h2 className="font-bold text-rose-300">Tout effacer</h2>
        <p className="mt-1 text-sm text-slate-400">
          Supprime aussi la carte (produits et stations). L'application repart totalement vide :
          à utiliser si tu veux tout ressaisir toi-même.
        </p>
        <Button variant="danger" className="mt-3" onClick={() => setConfirm("all")}>
          Tout effacer
        </Button>
      </Card>

      <Card className="p-4">
        <h2 className="font-bold text-slate-100">Vider seulement cet appareil</h2>
        <p className="mt-1 text-sm text-slate-400">
          Ne touche pas au serveur : efface le cache local de cette tablette puis recharge. Utile
          si un poste affiche des données incohérentes.
        </p>
        <Button
          variant="secondary"
          className="mt-3"
          onClick={async () => {
            if (!window.confirm("Vider les données locales de cet appareil et recharger ?")) return;
            await wipeLocalData();
            window.location.reload();
          }}
        >
          Vider le cache local
        </Button>
      </Card>

      <p className="px-1 text-xs text-slate-500">
        💡 Une remise à zéro est définitive côté application. Les dumps PostgreSQL et le miroir
        Google Sheet, eux, gardent la trace de ce qui a été effacé.
      </p>

      {done && (
        <p className="rounded-xl bg-emerald-600/20 p-3 text-sm text-emerald-300">
          ✓ {done} Rechargement…
        </p>
      )}

      <Modal open={confirm !== null} onClose={() => setConfirm(null)}>
        <h2 className="mb-2 text-lg font-bold text-rose-300">
          {confirm === "all" ? "Tout effacer ?" : "Effacer les ventes ?"}
        </h2>
        <p className="mb-4 text-sm text-slate-400">
          Cette action est <b className="text-slate-200">irréversible</b> et s'applique à tous les
          appareils. Tape <b className="text-slate-100">{expected}</b> pour confirmer.
        </p>
        <Input value={typed} onChange={setTyped} autoFocus placeholder={expected} />
        {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
        <div className="mt-5 flex gap-2">
          <Button variant="ghost" onClick={() => setConfirm(null)}>
            Annuler
          </Button>
          <div className="flex-1" />
          <Button variant="danger" disabled={typed.trim() !== expected || busy} onClick={run}>
            {busy ? "Effacement…" : "Confirmer"}
          </Button>
        </div>
      </Modal>
    </div>
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
  className,
  ...props
}: {
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-slate-100 outline-none focus:border-amber-400",
        className,
      )}
      {...props}
    />
  );
}
