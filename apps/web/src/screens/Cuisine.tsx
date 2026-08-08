import { useState } from "react";
import {
  preparedCount,
  soireeCarte,
  soldFromComponents,
  soldWithComponents,
  sortedStations,
  toPrepare,
  type ClientProduct,
} from "@cdf/shared";
import { projection } from "../lib/store.js";
import { useActiveSoiree, useRev } from "../lib/hooks.js";
import { markPrepared } from "../lib/actions.js";
import { Button } from "../components/ui.js";
import { NoSoiree } from "../components/NoSoiree.js";
import { cn } from "../lib/cn.js";

interface KitchenItem {
  product: ClientProduct;
  sold: number;
  viaMenus: number;
  prepared: number;
  remaining: number;
}

export function CuisineScreen() {
  useRev();
  const soiree = useActiveSoiree();
  const stations = sortedStations(projection);
  const [stationId, setStationId] = useState<string>(
    () => localStorage.getItem("cdf.stationId") ?? stations[0]?.id ?? "",
  );

  const changeStation = (id: string) => {
    setStationId(id);
    localStorage.setItem("cdf.stationId", id);
  };

  if (!soiree) return <NoSoiree />;
  const soireeId = soiree.id;

  // Produits à préparer pour ce poste : ceux de la carte PLUS leurs composants
  // (une frite incluse dans un menu doit apparaître même si elle n'est pas
  // vendue seule sur la carte).
  const relevant = new Set<string>();
  for (const e of soireeCarte(projection, soireeId)) {
    relevant.add(e.product.id);
    for (const c of e.product.components) relevant.add(c.productId);
  }
  const items: KitchenItem[] = [...relevant]
    .map((id) => projection.products[id])
    .filter((p): p is NonNullable<typeof p> => Boolean(p) && p.active && p.stationId === stationId)
    .map((p) => ({
      product: p,
      sold: soldWithComponents(projection, soireeId, p.id),
      viaMenus: soldFromComponents(projection, soireeId, p.id),
      prepared: preparedCount(projection, soireeId, p.id),
      remaining: toPrepare(projection, soireeId, p.id),
    }));

  const todo = items
    .filter((i) => i.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining || a.product.sortOrder - b.product.sortOrder);
  const done = items
    .filter((i) => i.remaining === 0)
    .sort((a, b) => a.product.sortOrder - b.product.sortOrder);
  const totalToPrepare = todo.reduce((s, i) => s + i.remaining, 0);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
        <select
          value={stationId}
          onChange={(e) => changeStation(e.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 font-semibold text-slate-100 outline-none focus:border-amber-400"
        >
          {stations.length === 0 && <option value="">Aucune station</option>}
          {stations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <div className="ml-auto text-right">
          <div className="text-xs uppercase tracking-wide text-slate-400">Total à préparer</div>
          <div className={cn("text-3xl font-black leading-none", totalToPrepare > 0 ? "text-amber-400" : "text-emerald-400")}>
            {totalToPrepare}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {items.length === 0 ? (
          <p className="mt-10 text-center text-slate-500">Aucun produit pour ce poste sur cette soirée.</p>
        ) : todo.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-emerald-400">
            <div className="text-6xl">✓</div>
            <div className="text-xl font-bold">Tout est à jour</div>
            <div className="text-sm text-slate-500">Rien à préparer pour le moment.</div>
          </div>
        ) : (
          <>
            {/* File à faire — priorité visuelle maximale */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {todo.map((it) => (
                <TodoCard key={it.product.id} item={it} soireeId={soireeId} stationId={stationId} />
              ))}
            </div>

            {/* À jour — compact et discret */}
            {done.length > 0 && (
              <>
                <div className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500">À jour</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                  {done.map((it) => (
                    <DoneCard key={it.product.id} item={it} soireeId={soireeId} stationId={stationId} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ prepared, sold }: { prepared: number; sold: number }) {
  const pct = sold > 0 ? Math.min(100, Math.round((prepared / sold) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function TodoCard({ item, soireeId, stationId }: { item: KitchenItem; soireeId: string; stationId: string }) {
  const { product, sold, prepared, remaining, viaMenus } = item;
  return (
    <div className="rounded-2xl border-2 border-amber-500/60 bg-amber-500/10 p-4">
      <div className="flex items-center gap-3">
        <span className="text-4xl">{product.emoji}</span>
        <span className="text-xl font-bold text-slate-100">{product.name}</span>
        <div className="ml-auto text-right">
          <div className="text-[10px] uppercase tracking-wide text-amber-300/80">À faire</div>
          <div className="text-5xl font-black leading-none text-amber-400">{remaining}</div>
        </div>
      </div>

      <div className="mt-3">
        <ProgressBar prepared={prepared} sold={sold} />
        <div className="mt-1.5 flex items-center justify-between text-xs text-slate-400">
          <span>
            Préparé <b className="text-slate-200">{prepared}</b> / {sold}
          </span>
          {viaMenus > 0 && <span className="text-slate-500">dont {viaMenus} en menu</span>}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        <Button variant="secondary" size="sm" className="h-12" onClick={() => markPrepared(product.id, stationId, -1, soireeId)}>
          −1
        </Button>
        <Button variant="success" size="sm" className="h-12 text-base" onClick={() => markPrepared(product.id, stationId, 1, soireeId)}>
          +1
        </Button>
        <Button variant="success" size="sm" className="h-12 text-base" onClick={() => markPrepared(product.id, stationId, 5, soireeId)}>
          +5
        </Button>
        <Button variant="success" size="sm" className="h-12 text-base" onClick={() => markPrepared(product.id, stationId, 10, soireeId)}>
          +10
        </Button>
      </div>
    </div>
  );
}

function DoneCard({ item, soireeId, stationId }: { item: KitchenItem; soireeId: string; stationId: string }) {
  const { product, sold, prepared } = item;
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-2.5">
      <span className="text-xl">{product.emoji}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-300">{product.name}</div>
        <div className="text-xs text-emerald-400">✓ {prepared}/{sold}</div>
      </div>
      <Button variant="ghost" size="sm" className="h-8 w-8 !px-0" onClick={() => markPrepared(product.id, stationId, 1, soireeId)}>
        +
      </Button>
    </div>
  );
}
