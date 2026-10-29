import { describe, expect, test } from "vitest";
import { parseReservationCsv } from "./reservationCsv.js";

describe("import CSV des réservations", () => {
  test("export Excel FR : « ; », BOM, en-têtes accentués, CRLF", () => {
    const csv = "﻿Nom;Prénom;Nb adultes;Nb enfants;Téléphone\r\nDupont;Jean;2;1;06 12 34 56 78\r\nLefèvre;;4;;\r\n";
    expect(parseReservationCsv(csv)).toEqual({
      rows: [
        { name: "Dupont Jean", adults: 2, children: 1, phone: "06 12 34 56 78" },
        { name: "Lefèvre", adults: 4, children: 0, phone: undefined },
      ],
      errors: [],
    });
  });

  test("« , » et guillemets", () => {
    const csv = 'name,adultes,enfants\n"Martin, famille",3,2\n"Le ""Grand"" Roux",1,0';
    expect(parseReservationCsv(csv).rows.map((r) => r.name)).toEqual(["Martin, famille", 'Le "Grand" Roux']);
  });

  test("les lignes illisibles sont signalées, pas ignorées", () => {
    const csv = "Nom;Adultes;Enfants\nDupont;deux;0\n;2;0\nVide;0;0\n;;\nOk;1;0";
    const { rows, errors } = parseReservationCsv(csv);
    expect(rows.map((r) => r.name)).toEqual(["Ok"]);
    expect(errors.map((e) => e.line)).toEqual([2, 3, 4]);
  });

  test("sans colonne Nom, rien n'est importé", () => {
    expect(parseReservationCsv("a;b\n1;2").errors[0].message).toMatch(/Nom/);
  });
});
