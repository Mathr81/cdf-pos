import { describe, expect, test } from "vitest";
import { decodeCsv, parseReservationCsv } from "./reservationCsv.js";

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

  test("accents : fichier Excel en Windows-1252 comme en UTF-8", () => {
    const text = "Nom;Adultes\nLefèvre Hélène;2\n";
    const cp1252 = Uint8Array.from(text, (c) => c.charCodeAt(0));
    expect(parseReservationCsv(decodeCsv(cp1252)).rows[0].name).toBe("Lefèvre Hélène");
    expect(parseReservationCsv(decodeCsv(new TextEncoder().encode(text))).rows[0].name).toBe("Lefèvre Hélène");
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
