import { downscaleForUpload } from "./downscale.js";
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

/** URL publique d'une image produit. Relative : même origine en dev comme en prod. */
export function mediaUrl(imageKey: string): string {
  return `/api/media/${imageKey}`;
}

export interface UploadedImage {
  imageKey: string;
  width: number;
  height: number;
  bytes: number;
  mode: "photo" | "icone";
}

export const api = {
  checkAuth: (accessCode: string, adminPin?: string) =>
    request<{ ok: boolean; isAdmin: boolean }>("/api/auth/check", {
      method: "POST",
      body: JSON.stringify({ accessCode, adminPin }),
    }),
  getState: () =>
    request<{ stations: { id: string; name: string; sortOrder: number }[] }>("/api/state"),
  /**
   * Remise à zéro (PIN admin requis). `sales` garde la carte, `all` efface tout.
   * Le serveur prévient ensuite tous les appareils connectés.
   */
  reset: (scope: "sales" | "all") =>
    request<{ scope: string; epoch: string; keptProducts: number; deletedMedia: number }>(
      "/api/admin/reset",
      { method: "POST", body: JSON.stringify({ scope }) },
    ),

  /**
   * Envoie une image produit. Nécessite le réseau : contrairement au reste de
   * l'app, cette action ne peut pas être mise en file d'attente hors ligne,
   * puisque le binaire ne transite pas par le journal d'événements.
   *
   * `mode` omis au premier envoi : le serveur présélectionne (SVG ou image non
   * opaque → « icone »), et renvoie le mode réellement appliqué pour que l'UI
   * puisse l'afficher et laisser l'admin le corriger.
   */
  uploadImage: async (file: File, mode?: "photo" | "icone"): Promise<UploadedImage> => {
    const { accessCode, adminPin } = useSession.getState();
    // Une photo d'iPad pèse souvent plus de 8 Mo pour un rendu final de 320px :
    // on la réduit avant de la pousser sur le wifi de la salle des fêtes.
    const payload = await downscaleForUpload(file);
    const form = new FormData();
    if (mode) form.append("mode", mode);
    form.append("file", payload);

    const headers: Record<string, string> = {};
    if (accessCode) headers["x-access-code"] = accessCode;
    if (adminPin) headers["x-admin-pin"] = adminPin;
    // Pas de content-type ici : le navigateur doit poser lui-même la frontière
    // multipart, la fixer à la main casserait le parsing côté serveur.

    const res = await fetch("/api/admin/media", { method: "POST", headers, body: form });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}) as { error?: string });
      if (body.error) throw new Error(body.error);
      // Un 413 sans corps JSON ne vient pas de l'application : c'est le reverse
      // proxy qui a coupé la requête avant elle (`client_max_body_size`).
      if (res.status === 413) {
        throw new Error("Image refusée par le serveur car trop lourde. Essaie une photo plus petite.");
      }
      throw new Error(`Erreur ${res.status}`);
    }
    return res.json() as Promise<UploadedImage>;
  },
};
