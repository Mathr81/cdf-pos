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
      className="fixed inset-0 z-50 flex items-end justify-center bg-night/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          "safe-bottom w-full max-w-lg rounded-t-surface border border-line bg-surface p-5",
          "animate-sheet-in shadow-[0_-8px_40px_rgba(0,0,0,0.5)] sm:rounded-surface",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
