import type { FastifyInstance } from "fastify";
import { env } from "../env.js";

export async function authRoutes(app: FastifyInstance) {
  /** Vérifie le code d'accès (et le PIN admin si fourni) au lancement de l'app. */
  app.post<{ Body: { accessCode?: string; adminPin?: string } }>(
    "/auth/check",
    {
      // Seule porte d'entrée de l'application, et le secret est court : sans
      // limite, il se devine par force brute en quelques minutes. Dix essais
      // par minute laissent largement passer un bénévole qui se trompe de
      // touche, et rendent l'attaque inexploitable.
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
          // Le client affiche `body.error` tel quel (voir web/src/lib/api.ts) :
          // c'est donc ce champ qui doit porter le message lisible.
          errorResponseBuilder: () => ({
            statusCode: 429,
            error: "Trop de tentatives. Réessaie dans une minute.",
          }),
        },
      },
    },
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
