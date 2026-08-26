import type { FastifyInstance } from "fastify";
import { authRoutes } from "./auth.js";
import { stateRoutes } from "./state.js";
import { eventsRoutes } from "./events.js";
import { adminRoutes } from "./admin.js";
import { mediaRoutes } from "./media.js";

export async function registerRoutes(app: FastifyInstance) {
  app.get("/api/health", async () => ({ ok: true, ts: new Date().toISOString() }));

  await app.register(authRoutes, { prefix: "/api" });
  await app.register(stateRoutes, { prefix: "/api" });
  await app.register(eventsRoutes, { prefix: "/api" });
  await app.register(adminRoutes, { prefix: "/api" });
  await app.register(mediaRoutes, { prefix: "/api" });
}
