import type { FastifyInstance } from "fastify";
import { getFullState } from "../state.js";
import { requireAccess } from "./guards.js";

export async function stateRoutes(app: FastifyInstance) {
  /**
   * Bootstrap : état courant complet (produits + stations + dérivés).
   * Utilisé au premier chargement d'un poste avant de basculer sur le temps réel.
   */
  app.get("/state", { preHandler: requireAccess }, async () => {
    return getFullState();
  });
}
