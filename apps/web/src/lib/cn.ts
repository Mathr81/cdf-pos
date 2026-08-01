import clsx, { type ClassValue } from "clsx";

/** Concatène des classes conditionnelles. */
export function cn(...args: ClassValue[]): string {
  return clsx(args);
}
