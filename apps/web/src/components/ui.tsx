import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { InfinityIcon } from "@phosphor-icons/react/dist/csr/Infinity";
import { ProhibitIcon } from "@phosphor-icons/react/dist/csr/Prohibit";
import { WarningIcon } from "@phosphor-icons/react/dist/csr/Warning";
import { cn } from "../lib/cn.js";

/* ═══════════════════════════════════════════════════════════════
   Socle d'interface.
   Une couleur = un métier :
     lantern → sélection et action primaire, rien d'autre
     mint    → confirmation
     signal  → danger réel
     dusk    → information neutre
   Un seul système de rayons : contrôles 14px, surfaces 20px,
   pastilles plein arrondi. Le rayon ne dépend jamais de la taille.
   ═══════════════════════════════════════════════════════════════ */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg" | "xl";

const variants: Record<Variant, string> = {
  primary: "bg-lantern text-night hover:brightness-110 active:brightness-95",
  secondary: "bg-well text-cream border border-line hover:border-sand/40 active:brightness-90",
  ghost: "bg-transparent text-sand hover:bg-well active:brightness-90",
  danger: "bg-signal text-night hover:brightness-110 active:brightness-95",
  success: "bg-mint text-night hover:brightness-110 active:brightness-95",
};

/**
 * Toutes les tailles respectent la cible tactile de 44px minimum.
 * `sm` sert aux actions secondaires, jamais aux gestes répétés du
 * service : Caisse et Cuisine utilisent `lg` et `xl`.
 */
const sizes: Record<Size, string> = {
  sm: "min-h-11 px-3 text-body",
  md: "min-h-12 px-4 text-body",
  lg: "min-h-14 px-5 text-lead",
  xl: "min-h-[4.5rem] px-6 text-title",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-control font-semibold",
        "transition-[filter,background-color,border-color] duration-150",
        "active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}

/** Bouton carré pour les steppers (+ / −). Toujours ≥ 44px. */
export function StepButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-control",
        "border border-line bg-well text-cream",
        "transition-[filter] duration-150 active:scale-[0.94] active:brightness-90",
        "disabled:opacity-40 disabled:pointer-events-none",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Trois élévations documentées, au lieu des cinq définitions
 * concurrentes de « carte » qui coexistaient dans l'app.
 *   flat    → posé sur le fond, séparé par un filet
 *   raised  → surface distincte (défaut)
 *   danger  → panneau destructif, emphase franche
 */
export function Card({
  className,
  tone = "raised",
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: "flat" | "raised" | "danger" }) {
  const tones = {
    flat: "border border-line bg-transparent",
    raised: "border border-line bg-surface",
    danger: "border-2 border-signal/70 bg-signal/10",
  };
  return <div className={cn("rounded-surface", tones[tone], className)} {...props} />;
}

/** Filet de séparation. Remplace les cartes empilées dans les listes. */
export function Row({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-control border border-line bg-surface px-3 py-2.5",
        className,
      )}
      {...props}
    />
  );
}

type Tone = "neutral" | "lantern" | "mint" | "signal" | "dusk";

const badgeTones: Record<Tone, string> = {
  neutral: "border border-line bg-well text-sand",
  lantern: "bg-lantern text-night",
  mint: "bg-mint text-night",
  signal: "bg-signal text-night",
  dusk: "bg-dusk text-night",
};

export function Badge({
  children,
  className,
  tone = "neutral",
}: {
  children: ReactNode;
  className?: string;
  tone?: Tone;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-micro font-bold",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Petite étiquette de section. Une seule définition pour toute l'app. */
export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1.5 block text-micro font-bold tracking-wide text-ash uppercase">
      {children}
    </span>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      {children}
    </label>
  );
}

/** Champ de saisie : hauteur tactile, contraste vérifié, focus lantern. */
export function TextInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-12 w-full rounded-control border border-line bg-well px-3 text-cream",
        "placeholder:text-ash outline-none focus:border-lantern",
        className,
      )}
      {...props}
    />
  );
}

export function SelectInput({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "min-h-12 rounded-control border border-line bg-well px-3 text-cream",
        "outline-none focus:border-lantern",
        className,
      )}
      {...props}
    />
  );
}

/**
 * État de stock. L'escalade se fait par la FORME autant que par la teinte,
 * jamais par la couleur seule : glyphe, puis contour, puis aplat plein.
 *
 * Motivé par la simulation daltonisme : en deutéranopie, --lantern et
 * --signal convergent vers deux olives séparés de seulement ΔE00 ≈ 11.
 * Une pastille pleine « épuisé » et une pastille pleine de quantité
 * seraient alors proches. Le glyphe et le mot les séparent sans dépendre
 * de la teinte.
 *
 * `stock === null` = stock illimité (rien à suivre).
 */
export function StockChip({ stock, className }: { stock: number | null; className?: string }) {
  if (stock === null) {
    return (
      <span
        className={cn("inline-flex items-center gap-1 text-micro font-bold text-dusk", className)}
        title="Stock illimité"
      >
        <InfinityIcon size={16} weight="bold" />
      </span>
    );
  }
  if (stock <= 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-signal px-2 py-1 text-micro font-black tracking-wide text-night uppercase",
          className,
        )}
      >
        <ProhibitIcon size={13} weight="bold" />
        Épuisé
      </span>
    );
  }
  if (stock <= 10) {
    return (
      <span
        className={cn(
          "tnum inline-flex items-center gap-1 rounded-full border-2 border-signal px-2 py-0.5 text-micro font-bold text-signal",
          className,
        )}
      >
        <WarningIcon size={12} weight="fill" />
        {stock} restants
      </span>
    );
  }
  return (
    <span className={cn("tnum text-micro font-semibold text-sand", className)}>{stock} en stock</span>
  );
}

/** État vide composé. Remplace les `<p>` gris centrés de l'app. */
export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {icon && <div className="text-ash">{icon}</div>}
      <p className="font-display text-lead font-bold text-cream">{title}</p>
      {hint && <p className="max-w-sm text-body text-sand">{hint}</p>}
      {action}
    </div>
  );
}

/** Squelette de chargement, calé sur la forme du contenu final. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("rounded-control bg-well", className)} />;
}
