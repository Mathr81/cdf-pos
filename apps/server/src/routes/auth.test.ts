import Fastify, { type FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { authRoutes } from "./auth.js";

/**
 * `/auth/check` est la seule porte d'entrée de l'application et le secret est
 * court. Ces tests vérifient la limite de débit, qui ne peut pas l'être à la
 * main : elle ne se déclenche qu'au onzième essai en moins d'une minute.
 *
 * La route ne touche pas Prisma — on peut donc monter une instance Fastify
 * nue, sans base de données.
 */

const CODE = "code-de-test";

let app: FastifyInstance;

beforeEach(async () => {
  app = Fastify({ trustProxy: true });
  await app.register(rateLimit, { global: false });
  await app.register(authRoutes, { prefix: "/api" });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

/** Un essai depuis une IP donnée — `trustProxy` la lit dans X-Forwarded-For. */
function check(accessCode: string, ip = "10.0.0.1") {
  return app.inject({
    method: "POST",
    url: "/api/auth/check",
    headers: { "x-forwarded-for": ip },
    payload: { accessCode },
  });
}

describe("/auth/check", () => {
  test("accepte le bon code d'accès", async () => {
    const res = await check(CODE);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, isAdmin: false });
  });

  test("refuse un mauvais code d'accès", async () => {
    const res = await check("mauvais");

    expect(res.statusCode).toBe(401);
  });

  test("reconnaît le PIN admin", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/check",
      payload: { accessCode: CODE, adminPin: "4321" },
    });

    expect(res.json()).toMatchObject({ ok: true, isAdmin: true });
  });

  test("laisse passer dix tentatives par minute", async () => {
    for (let i = 0; i < 10; i++) {
      expect((await check("mauvais")).statusCode).toBe(401);
    }
  });

  test("bloque la onzième tentative", async () => {
    for (let i = 0; i < 10; i++) await check("mauvais");

    const res = await check("mauvais");

    expect(res.statusCode).toBe(429);
  });

  test("renvoie un message lisible, dans le champ que le client affiche", async () => {
    for (let i = 0; i < 10; i++) await check("mauvais");

    const res = await check("mauvais");

    // web/src/lib/api.ts lève `new Error(body.error)`.
    expect(res.json().error).toBe("Trop de tentatives. Réessaie dans une minute.");
  });

  /* Le compteur doit être par IP : sinon, derrière le reverse proxy, dix
     essais suffiraient à verrouiller toute la salle des fêtes. */
  test("compte séparément chaque adresse IP", async () => {
    for (let i = 0; i < 10; i++) await check("mauvais", "10.0.0.1");

    const autreTablette = await check("mauvais", "10.0.0.2");

    expect(autreTablette.statusCode).toBe(401);
  });
});
