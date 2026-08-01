import type { FastifyInstance } from "fastify";
import { env } from "../env.js";

export async function authRoutes(app: FastifyInstance) {
  /** Vérifie le code d'accès (et le PIN admin si fourni) au lancement de l'app. */
  app.post<{ Body: { accessCode?: string; adminPin?: string } }>(
    "/auth/check",
    async (req, reply) => {
      const { accessCode, adminPin } = req.body ?? {};
      if (accessCode !== env.appAccessCode) {
        return reply.code(401).send({ ok: false, error: "Code d'accès invalide" });
      }
      const isAdmin = adminPin !== undefined && adminPin === env.adminPin;
      return { ok: true, isAdmin };
    },
  );
}
