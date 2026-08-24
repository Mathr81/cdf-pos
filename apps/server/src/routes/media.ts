import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import {
  MAX_UPLOAD_BYTES,
  MediaError,
  isValidKey,
  mediaPath,
  processUpload,
  suggestMode,
  type MediaMode,
} from "../media.js";
import { requireAdmin } from "./guards.js";

const MODES: MediaMode[] = ["photo", "icone"];

export async function mediaRoutes(app: FastifyInstance) {
  await app.register(multipart, {
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 4 },
  });

  /**
   * Upload d'une image produit. Réservé à l'admin, comme la remise à zéro.
   * Renvoie une référence, jamais le binaire : c'est cette référence seule
   * qui partira ensuite dans l'événement `product_upsert`.
   */
  app.post("/admin/media", { preHandler: requireAdmin }, async (req, reply) => {
    const file = await req.file().catch(() => null);
    if (!file) return reply.code(400).send({ error: "Aucun fichier reçu" });

    let buf: Buffer;
    try {
      buf = await file.toBuffer();
    } catch {
      return reply.code(413).send({ error: "Fichier trop volumineux (max 8 Mo)" });
    }
    if (file.file.truncated) {
      return reply.code(413).send({ error: "Fichier trop volumineux (max 8 Mo)" });
    }

    // Le mode vient d'un bouton explicite côté admin. S'il est absent (premier
    // envoi), on présélectionne. Une détection automatique ne suffit PAS comme
    // décision finale : elle se trompe dans les deux sens, un logo aplati sur
    // fond blanc n'a pas d'alpha, et un PNG RGBA opaque en a un sans être un
    // logo. C'est une suggestion, l'admin tranche.
    const raw = (file.fields?.mode as { value?: string } | undefined)?.value;
    const mode: MediaMode = MODES.includes(raw as MediaMode)
      ? (raw as MediaMode)
      : await suggestMode(buf);

    try {
      return await processUpload(buf, mode);
    } catch (e) {
      if (e instanceof MediaError) return reply.code(400).send({ error: e.message });
      req.log.error({ err: e }, "[media] échec du traitement");
      return reply.code(500).send({ error: "Traitement de l'image impossible" });
    }
  });

  /**
   * Service des fichiers. Volontairement HORS authentification : une balise
   * `<img>` ne peut pas porter l'en-tête `x-access-code`, et passer par fetch +
   * blob compliquerait beaucoup la mise en cache par le service worker. Les
   * clés sont des hashes de 128 bits, donc non devinables.
   *
   * Contenu adressé par son hash donc immuable : cache immortel côté client,
   * ce qui rend la stratégie CacheFirst du service worker exacte et non
   * seulement pratique.
   */
  app.get<{ Params: { key: string } }>("/media/:key", async (req, reply) => {
    const { key } = req.params;
    if (!isValidKey(key)) return reply.code(400).send({ error: "Clé invalide" });

    const path = mediaPath(key);
    const info = await stat(path).catch(() => null);
    if (!info?.isFile()) return reply.code(404).send({ error: "Image introuvable" });

    return reply
      .header("content-type", "image/webp")
      .header("content-length", info.size)
      .header("cache-control", "public, max-age=31536000, immutable")
      .send(createReadStream(path));
  });
}
