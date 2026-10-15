import { expect, test } from "vitest";
import { isAmount, isCount } from "./validate.js";

test("isAmount", () => {
  for (const ok of ["5", "5,5", "5,50", "12.5", " 8,00 ", "0"]) expect(isAmount(ok)).toBe(true);
  for (const ko of ["", "abc", "5,555", "-2", "5€", "1,2,3", "12345"]) expect(isAmount(ko)).toBe(false);
});

test("isCount", () => {
  for (const ok of ["0", "60", " 150 "]) expect(isCount(ok)).toBe(true);
  for (const ko of ["", "-1", "1,5", "abc", "123456"]) expect(isCount(ko)).toBe(false);
});
