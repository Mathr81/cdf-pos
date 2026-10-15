import { describe, expect, test } from "vitest";
import { applyKey } from "./Numpad.js";

const type = (keys: string[]) => keys.reduce(applyKey, "");

describe("applyKey", () => {
  test("saisie simple et décimales", () => {
    expect(type(["1", "2", ",", "5", "0"])).toBe("12,50");
  });
  test("deux décimales au plus, une seule virgule", () => {
    expect(type(["1", ",", "5", "0", "9", ","])).toBe("1,50");
  });
  test("pas de zéros de tête", () => {
    expect(type(["0", "0", "7"])).toBe("7");
    expect(type(["0", ",", "5"])).toBe("0,5");
  });
  test("virgule seule → 0,", () => {
    expect(type([","])).toBe("0,");
  });
  test("partie entière plafonnée à 4 chiffres", () => {
    expect(type(["9", "9", "9", "9", "9"])).toBe("9999");
    expect(type(["9", "9", "9", "9", ",", "5"])).toBe("9999,5");
  });
  test("retour arrière", () => {
    expect(applyKey("12,5", "⌫")).toBe("12,");
    expect(applyKey("", "⌫")).toBe("");
  });
});
