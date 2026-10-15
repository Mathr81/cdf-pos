import { describe, expect, test } from "vitest";
import { readSecret } from "./env.js";

describe("readSecret", () => {
  test("en dev, retombe sur la valeur de confort", () => {
    expect(readSecret("CODE", "fete2026", {})).toBe("fete2026");
    expect(readSecret("CODE", "fete2026", { CODE: "" })).toBe("fete2026");
  });

  test("en prod, accepte une vraie valeur", () => {
    expect(readSecret("CODE", "fete2026", { NODE_ENV: "production", CODE: "s3cr3t" })).toBe("s3cr3t");
  });

  /* Le dépôt est public : la valeur d'exemple est connue de tous. */
  test("en prod, refuse la valeur d'exemple publique", () => {
    expect(() => readSecret("CODE", "fete2026", { NODE_ENV: "production", CODE: "fete2026" })).toThrow();
  });

  /* compose transmet une variable absente du .env comme une chaîne vide. */
  test("en prod, refuse une valeur vide ou absente", () => {
    expect(() => readSecret("CODE", "fete2026", { NODE_ENV: "production", CODE: "" })).toThrow();
    expect(() => readSecret("CODE", "fete2026", { NODE_ENV: "production" })).toThrow();
  });
});
