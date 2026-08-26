import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import type { IoServer } from "./ingest.js";
import { env } from "./env.js";
import { prisma } from "./db.js";
import { createSocketServer } from "./socket.js";
import { registerRoutes } from "./routes/index.js";
import { startBackupWorker } from "./backup/sheets.js";

declare module "fastify" {
  interface FastifyInstance {
    io: IoServer;
  }
}

async function main() {
  // `trustProxy` : en production deux proxys se succèdent (NPM → nginx interne).
  // Sans lui, `req.ip` vaut l'adresse du proxy et le compteur du rate limit
  // serait PARTAGÉ par toutes les tablettes — dix essais pour toute la salle.
  // nginx.conf transmet déjà `X-Forwarded-For`.
  const app = Fastify({ logger: true, trustProxy: true });

  await app.register(cors, {
    origin: env.corsOrigin,
    credentials: true,
    allowedHeaders: ["content-type", "x-access-code", "x-admin-pin"],
  });

  // Désactivé par défaut : seule la route de vérification du code d'accès en
  // a besoin. Les autres routes sont déjà protégées par ce même code, et
  // limiter la synchro d'une soirée chargée serait contre-productif.
  await app.register(rateLimit, { global: false });

  // Socket.IO se greffe sur le serveur HTTP sous-jacent de Fastify.
  const io = createSocketServer(app.server);
  app.decorate("io", io);

  await registerRoutes(app);

  await app.listen({ port: env.port, host: "0.0.0.0" });
  app.log.info(`Serveur prêt sur :${env.port} (HTTP + Socket.IO)`);

  // Worker de sauvegarde Google Sheet (no-op si désactivé).
  startBackupWorker(io);

  const shutdown = async () => {
    app.log.info("Arrêt en cours…");
    await io.close();
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
