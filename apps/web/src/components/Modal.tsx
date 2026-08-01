import type { ReactNode } from "react";
import { cn } from "../lib/cn.js";

export function Modal({
  open,
  onClose,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          "w-full max-w-lg rounded-t-3xl border border-slate-800 bg-slate-900 p-5 shadow-2xl animate-fade-in sm:rounded-2xl safe-bottom",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
