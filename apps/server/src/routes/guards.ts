import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../env.js";

/** Vérifie le code d'accès applicatif (header `x-access-code`). */
export async function requireAccess(req: FastifyRequest, reply: FastifyReply) {
  const code = req.headers["x-access-code"];
  if (code !== env.appAccessCode) {
    reply.code(401).send({ error: "Code d'accès invalide" });
  }
}

/** Vérifie le PIN admin (header `x-admin-pin`) en plus du code d'accès. */
export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  const code = req.headers["x-access-code"];
  const pin = req.headers["x-admin-pin"];
  if (code !== env.appAccessCode) {
    reply.code(401).send({ error: "Code d'accès invalide" });
    return;
  }
  if (pin !== env.adminPin) {
    reply.code(403).send({ error: "PIN administrateur invalide" });
  }
}
