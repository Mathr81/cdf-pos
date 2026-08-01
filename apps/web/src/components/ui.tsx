import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn.js";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg" | "xl";

const variants: Record<Variant, string> = {
  primary: "bg-amber-500 text-slate-950 hover:bg-amber-400 active:bg-amber-600",
  secondary: "bg-slate-700 text-slate-100 hover:bg-slate-600 active:bg-slate-800",
  ghost: "bg-transparent text-slate-300 hover:bg-slate-800 active:bg-slate-700",
  danger: "bg-rose-600 text-white hover:bg-rose-500 active:bg-rose-700",
  success: "bg-emerald-600 text-white hover:bg-emerald-500 active:bg-emerald-700",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm rounded-lg",
  md: "px-4 py-2.5 text-base rounded-xl",
  lg: "px-5 py-3.5 text-lg rounded-xl",
  xl: "px-6 py-5 text-2xl rounded-2xl",
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
        "font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-800 bg-slate-900/70 backdrop-blur",
        className,
      )}
      {...props}
    />
  );
}

export function Badge({
  children,
  className,
  tone = "slate",
}: {
  children: ReactNode;
  className?: string;
  tone?: "slate" | "amber" | "emerald" | "rose" | "sky";
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-700/60 text-slate-200",
    amber: "bg-amber-500/20 text-amber-300",
    emerald: "bg-emerald-500/20 text-emerald-300",
    rose: "bg-rose-500/20 text-rose-300",
    sky: "bg-sky-500/20 text-sky-300",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
