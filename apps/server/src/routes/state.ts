import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { requireAccess } from "./guards.js";

export async function stateRoutes(app: FastifyInstance) {
  /**
   * Stations cuisine, pour l'écran de choix du poste : il s'affiche avant que
   * le journal local ne soit synchronisé. Tout le reste (ventes, stock) se
   * calcule sur la tablette à partir du journal.
   */
  app.get("/state", { preHandler: requireAccess }, async () => ({
    stations: await prisma.station.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, sortOrder: true },
    }),
  }));
}
