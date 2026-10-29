import { describe, expect, test } from "vitest";
import { decodeCsv, parseReservationCsv } from "./reservationCsv.js";

const TARIFS = [
  { productId: "resa-adulte", name: "Repas adulte" },
  { productId: "resa-enfant", name: "Enfant" },
  { productId: "resa-bebe", name: "Moins de 3 ans" },
];
const parse = (csv: string) => parseReservationCsv(csv, TARIFS);

describe("import CSV des réservations", () => {
  test("export Excel FR : « ; », BOM, en-têtes accentués, CRLF", () => {
    const csv = "﻿Nom;Prénom;Nb adultes;Nb enfants;Téléphone\r\nDupont;Jean;2;1;06 12 34 56 78\r\nLefèvre;;4;;\r\n";
    expect(parse(csv)).toEqual({
      rows: [
        { name: "Dupont Jean", counts: { "resa-adulte": 2, "resa-enfant": 1 }, phone: "06 12 34 56 78", prepaid: false, note: undefined },
        { name: "Lefèvre", counts: { "resa-adulte": 4 }, phone: undefined, prepaid: false, note: undefined },
      ],
      errors: [],
      ignored: [],
    });
  });

  test("« Nom Prénom » en une colonne, en-têtes au pluriel", () => {
    expect(parse("Nom Prénom;Adultes\nDupont Jean;2\n").rows[0].name).toBe("Dupont Jean");
    expect(parse("Noms;Adultes\nDupont;2\n").rows[0].name).toBe("Dupont");
  });

  test("accents : fichier Excel en Windows-1252 comme en UTF-8", () => {
    const text = "Nom;Adultes\nLefèvre Hélène;2\n";
    const cp1252 = Uint8Array.from(text, (c) => c.charCodeAt(0));
    expect(parse(decodeCsv(cp1252)).rows[0].name).toBe("Lefèvre Hélène");
    expect(parse(decodeCsv(new TextEncoder().encode(text))).rows[0].name).toBe("Lefèvre Hélène");
  });

  test("tarifs de la soirée, payé d'avance, remarques, colonnes inconnues", () => {
    const csv =
      "Nom;Adultes;Enfants (-12 ans);Moins de 3 ans;Payé;Table;Allergies;Mail\n" +
      "Roux;2;1;1;oui;4;arachide;a@b.fr\n" +
      "Martin;3;;;non;;;\n";
    const { rows, ignored } = parse(csv);
    expect(rows[0]).toMatchObject({
      counts: { "resa-adulte": 2, "resa-enfant": 1, "resa-bebe": 1 },
      prepaid: true,
      table: "4",
      note: "arachide",
    });
    expect(rows[1]).toMatchObject({ prepaid: false, table: undefined, note: undefined });
    expect(ignored).toEqual(["Mail"]);
  });

  test("« , » et guillemets", () => {
    const csv = 'name,adultes,enfants\n"Martin, famille",3,2\n"Le ""Grand"" Roux",1,0';
    expect(parse(csv).rows.map((r) => r.name)).toEqual(["Martin, famille", 'Le "Grand" Roux']);
  });

  test("les lignes illisibles sont signalées, pas ignorées", () => {
    const csv = "Nom;Adultes;Enfants\nDupont;deux;0\n;2;0\nVide;0;0\n;;\nOk;1;0";
    const { rows, errors } = parse(csv);
    expect(rows.map((r) => r.name)).toEqual(["Ok"]);
    expect(errors.map((e) => e.line)).toEqual([2, 3, 4]);
  });

  test("sans colonne Nom ou sans tarif reconnu, rien n'est importé", () => {
    expect(parse("a;b\n1;2").errors[0].message).toMatch(/Nom/);
    expect(parse("Nom;Places\nX;2").errors[0].message).toMatch(/tarif/);
  });
});
