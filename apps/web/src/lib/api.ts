import type { StatsResponse } from "@cdf/shared";
import { useSession } from "./session.js";

/**
 * Client HTTP minimal. Les chemins sont relatifs (même origine) : en dev, le
 * proxy Vite redirige /api vers le serveur ; en prod, nginx fait de même.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { accessCode, adminPin } = useSession.getState();
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(init?.headers as Record<string, string>),
  };
  if (accessCode) headers["x-access-code"] = accessCode;
  if (adminPin) headers["x-admin-pin"] = adminPin;

  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Erreur ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  checkAuth: (accessCode: string, adminPin?: string) =>
    request<{ ok: boolean; isAdmin: boolean }>("/api/auth/check", {
      method: "POST",
      body: JSON.stringify({ accessCode, adminPin }),
    }),
  getStats: () => request<StatsResponse>("/api/stats"),
  getState: () =>
    request<{ stations: { id: string; name: string; sortOrder: number }[] }>("/api/state"),
};
