import { normalizeName } from "@cdf/shared";

/**
 * Lecture du CSV des réservations (export Excel, Google Sheets…).
 * Séparateur « ; » (Excel FR), « , » ou tabulation, détecté sur l'en-tête.
 * Colonnes reconnues par leur nom, sans accent ni casse : nom (et prénom),
 * adultes, enfants, téléphone. Les lignes illisibles sont rendues à part, jamais
 * ignorées en silence : une famille oubliée à l'import arrive quand même.
 */

export interface ParsedReservation {
  name: string;
  adults: number;
  children: number;
  phone?: string;
}

export interface CsvResult {
  rows: ParsedReservation[];
  errors: { line: number; message: string }[];
}

/**
 * Excel FR enregistre « CSV (séparateur : point-virgule) » en Windows-1252,
 * pas en UTF-8 : lu en UTF-8, « Lefèvre » devient « Lef�vre ». Un fichier
 * qui n'est pas de l'UTF-8 valide est donc relu en Windows-1252.
 */
export function decodeCsv(bytes: ArrayBuffer | Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/** Découpe en lignes et champs, guillemets RFC 4180 compris ("" = guillemet). */
function splitCsv(text: string, sep: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      out.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    out.push(row);
  }
  return out;
}

/** `firstName` : une colonne Prénom séparée est accolée au nom. */
function column(header: string): keyof ParsedReservation | "firstName" | null {
  const h = normalizeName(header);
  if (/\bprenom\b/.test(h)) return "firstName";
  if (h.includes("adulte")) return "adults";
  if (h.includes("enfant")) return "children";
  if (/\b(tel|telephone|phone|portable|mobile)\b/.test(h)) return "phone";
  if (/\b(nom|name|famille|client)\b/.test(h)) return "name";
  return null;
}

export function parseReservationCsv(raw: string): CsvResult {
  const text = raw.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = [";", ",", "\t"].reduce((best, s) =>
    firstLine.split(s).length > firstLine.split(best).length ? s : best,
  );
  const [header = [], ...lines] = splitCsv(text, sep);
  const cols = header.map(column);
  const errors: CsvResult["errors"] = [];
  if (!cols.includes("name")) {
    return { rows: [], errors: [{ line: 1, message: "Colonne « Nom » introuvable dans la première ligne" }] };
  }

  const rows: ParsedReservation[] = [];
  lines.forEach((cells, i) => {
    const line = i + 2;
    if (cells.every((c) => c.trim() === "")) return;
    const r: ParsedReservation = { name: "", adults: 0, children: 0 };
    let bad: string | null = null;
    cols.forEach((col, j) => {
      const v = (cells[j] ?? "").trim();
      if (col === "name") r.name = [v, r.name].filter(Boolean).join(" ");
      else if (col === "firstName") r.name = [r.name, v].filter(Boolean).join(" ");
      else if (col === "phone") r.phone = v || undefined;
      else if (col === "adults" || col === "children") {
        if (v === "") return;
        if (!/^\d{1,3}$/.test(v)) bad = `« ${v} » n'est pas un nombre de personnes`;
        else r[col] = Number(v);
      }
    });
    if (!r.name) bad ??= "nom manquant";
    else if (r.adults + r.children === 0) bad ??= "aucune personne (adultes et enfants à 0)";
    if (bad) errors.push({ line, message: `${r.name || "?"} : ${bad}` });
    else rows.push({ ...r, name: r.name.slice(0, 120), phone: r.phone?.slice(0, 40) });
  });
  return { rows, errors };
}
