import { useState } from "react";
import {
  soldFromComponents,
  soldWithComponents,
  sortedProducts,
  sortedStations,
  toPrepare,
  type ClientProduct,
} from "@cdf/shared";
import { projection } from "../lib/store.js";
import { useRev } from "../lib/hooks.js";
import { markPrepared } from "../lib/actions.js";
import { Button } from "../components/ui.js";
import { cn } from "../lib/cn.js";

export function CuisineScreen() {
  useRev();
  const stations = sortedStations(projection);
  const [stationId, setStationId] = useState<string>(
    () => localStorage.getItem("cdf.stationId") ?? stations[0]?.id ?? "",
  );

  const changeStation = (id: string) => {
    setStationId(id);
    localStorage.setItem("cdf.stationId", id);
  };

  const items = sortedProducts(projection)
    .filter((p) => p.active && p.stationId === stationId)
    .map((p) => ({
      product: p,
      // Ventes directes + portions incluses dans les plats composés.
      sold: soldWithComponents(projection, p.id),
      viaMenus: soldFromComponents(projection, p.id),
      prepared: projection.prepared[p.id] ?? 0,
      remaining: toPrepare(projection, p.id),
    }))
    .sort((a, b) => b.remaining - a.remaining || a.product.sortOrder - b.product.sortOrder);

  const totalToPrepare = items.reduce((s, i) => s + i.remaining, 0);

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
          <div className="text-xs uppercase tracking-wide text-slate-400">À préparer</div>
          <div className={cn("text-2xl font-black", totalToPrepare > 0 ? "text-amber-400" : "text-emerald-400")}>
            {totalToPrepare}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {items.length === 0 ? (
          <p className="mt-10 text-center text-slate-500">Aucun produit pour ce poste.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((it) => (
              <KitchenCard
                key={it.product.id}
                product={it.product}
                sold={it.sold}
                viaMenus={it.viaMenus}
                prepared={it.prepared}
                remaining={it.remaining}
                stationId={stationId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KitchenCard({
  product,
  sold,
  viaMenus,
  prepared,
  remaining,
  stationId,
}: {
  product: ClientProduct;
  sold: number;
  viaMenus: number;
  prepared: number;
  remaining: number;
  stationId: string;
}) {
  const urgent = remaining > 0;
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 transition-colors",
        urgent ? "border-amber-500/50 bg-amber-500/10" : "border-slate-800 bg-slate-900/60",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-3xl">{product.emoji}</span>
        <span className="text-lg font-bold text-slate-100">{product.name}</span>
        <div className="ml-auto text-right">
          <div className="text-xs uppercase tracking-wide text-slate-400">Reste</div>
          <div className={cn("text-4xl font-black leading-none", urgent ? "text-amber-400" : "text-emerald-400")}>
            {remaining}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-slate-400">
        <span>Vendu&nbsp;<b className="text-slate-200">{sold}</b></span>
        <span>Préparé&nbsp;<b className="text-slate-200">{prepared}</b></span>
      </div>
      {viaMenus > 0 && (
        <p className="mt-1 text-xs text-slate-500">dont {viaMenus} inclus dans un plat</p>
      )}

      <div className="mt-3 grid grid-cols-4 gap-2">
        <Button variant="secondary" size="sm" className="h-11" onClick={() => markPrepared(product.id, stationId, -1)}>
          −1
        </Button>
        <Button variant="success" size="sm" className="h-11 text-base" onClick={() => markPrepared(product.id, stationId, 1)}>
          +1
        </Button>
        <Button variant="success" size="sm" className="h-11 text-base" onClick={() => markPrepared(product.id, stationId, 5)}>
          +5
        </Button>
        <Button variant="success" size="sm" className="h-11 text-base" onClick={() => markPrepared(product.id, stationId, 10)}>
          +10
        </Button>
      </div>
    </div>
  );
}
