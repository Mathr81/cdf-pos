import type { FastifyInstance } from "fastify";
import { resetData, type ResetScope } from "../reset.js";
import { requireAdmin } from "./guards.js";

const SCOPES: ResetScope[] = ["sales", "all"];

export async function adminRoutes(app: FastifyInstance) {
  /**
   * Remise à zéro. `scope: "sales"` efface l'exploitation (ventes, stocks,
   * préparations) et garde la carte ; `scope: "all"` efface aussi les produits
   * et stations. Dans les deux cas l'epoch change et tous les appareils
   * connectés purgent leur journal local.
   */
  app.post<{ Body: { scope?: string } }>(
    "/admin/reset",
    { preHandler: requireAdmin },
    async (req, reply) => {
      const scope = req.body?.scope as ResetScope | undefined;
      if (!scope || !SCOPES.includes(scope)) {
        return reply.code(400).send({ error: "scope doit valoir « sales » ou « all »" });
      }

      const result = await resetData(scope);
      app.log.warn({ result }, "[admin] remise à zéro effectuée");

      // Les postes encore ouverts se purgent et se rechargent immédiatement.
      app.io.emit("server:reset", { epoch: result.epoch });

      return result;
    },
  );
}
