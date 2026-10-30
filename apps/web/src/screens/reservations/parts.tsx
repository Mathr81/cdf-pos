import { formatCents, type Counts, type Tariff } from "@cdf/shared";
import { MinusIcon } from "@phosphor-icons/react/dist/csr/Minus";
import { NoteIcon } from "@phosphor-icons/react/dist/csr/Note";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";

import { cn } from "../../lib/cn.js";
import { StepButton, TextInput } from "../../components/ui.js";

/** « Table 12 » : là où l'accueil place le groupe. */
export function TableTag({ table, large }: { table: string; large?: boolean }) {
  return (
    <span
      className={cn(
        "tnum shrink-0 rounded-control border border-line bg-well font-bold whitespace-nowrap text-cream",
        large ? "px-3 py-1 text-lead" : "px-1.5 py-0.5 text-micro",
      )}
    >
      Table {table}
    </span>
  );
}

export function NoteBox({ note, large }: { note: string; large?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-control border border-lantern/60 bg-lantern/10 text-cream",
        large ? "mt-3 p-3 text-lead font-bold" : "mt-1 px-2 py-1 text-micro",
      )}
    >
      <NoteIcon size={large ? 22 : 14} weight="bold" className="mt-0.5 shrink-0 text-lantern" />
      <span className="min-w-0">{note}</span>
    </div>
  );
}

function Counter({
  label,
  unitCents,
  value,
  onChange,
}: {
  label: string;
  unitCents: number;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-control border border-line bg-well p-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-lead font-bold text-cream">{label}</div>
        <div className="tnum text-micro text-ash">{formatCents(unitCents)} / personne</div>
      </div>
      <StepButton aria-label={`${label} : un de moins`} disabled={value === 0} onClick={() => onChange(value - 1)}>
        <MinusIcon size={18} weight="bold" />
      </StepButton>
      {/* Saisie directe : 2 arrivés sur 24, sans 22 appuis sur « − ». Plafond = schéma `heads`. */}
      {/* Largeur sur l'enveloppe : TextInput impose w-full. */}
      <div className="w-16 shrink-0">
        <TextInput
          inputMode="numeric"
          aria-label={`${label} : nombre`}
          value={String(value)}
          onChange={(e) => onChange(Math.min(999, Number(e.target.value.replace(/\D/g, "")) || 0))}
          onFocus={(e) => e.target.select()}
          className="tnum font-display px-1 text-center text-title font-bold"
        />
      </div>
      <StepButton aria-label={`${label} : un de plus`} onClick={() => onChange(value + 1)}>
        <PlusIcon size={18} weight="bold" />
      </StepButton>
    </div>
  );
}

export function Counters({ tariffs, counts, onChange }: { tariffs: Tariff[]; counts: Counts; onChange: (c: Counts) => void }) {
  return (
    <div className="space-y-2">
      {tariffs.map((t) => (
        <Counter
          key={t.productId}
          label={t.name}
          unitCents={t.priceCents}
          value={counts[t.productId] ?? 0}
          onChange={(n) => onChange({ ...counts, [t.productId]: n })}
        />
      ))}
    </div>
  );
}
