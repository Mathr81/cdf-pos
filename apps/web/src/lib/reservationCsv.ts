import { normalizeName } from "@cdf/shared";

/**
 * Lecture du CSV des réservations (export Excel, Google Sheets…).
 * Séparateur « ; » (Excel FR), « , » ou tabulation, détecté sur l'en-tête.
 * Colonnes reconnues par leur nom, sans accent ni casse : nom (et prénom),
 * une colonne par tarif de la soirée (« Adultes », « Nb enfants »,
 * « Étudiants »…), téléphone, table, remarque (ou allergie…) et payé. Les
 * lignes illisibles sont rendues à part, jamais ignorées en silence : une
 * famille oubliée à l'import arrive quand même.
 */

export interface ParsedReservation {
  name: string;
  counts: Record<string, number>;
  phone?: string;
  table?: string;
  note?: string;
  prepaid: boolean;
}

export interface CsvResult {
  rows: ParsedReservation[];
  errors: { line: number; message: string }[];
  /** En-têtes qui ne correspondent à rien : souvent un tarif mal nommé. */
  ignored: string[];
}

type Column =
  | { kind: "name" | "firstName" | "phone" | "table" | "note" | "prepaid" }
  | { kind: "tariff"; productId: string }
  | null;

/** Mots significatifs, au singulier : « Nb adultes » → ["adulte"]. */
function words(s: string): string[] {
  const filler = new Set(["nb", "nbre", "nombre", "de", "des", "repas", "tarif", "personnes", "pers"]);
  return normalizeName(s)
    .split(" ")
    .filter((w) => w.length >= 3 && !filler.has(w))
    .map((w) => w.replace(/s$/, ""));
}

function column(header: string, tariffs: { productId: string; name: string }[]): Column {
  const h = normalizeName(header);
  // « Nom Prénom » en une seule colonne est un nom complet, pas un prénom.
  if (/\bprenoms?\b/.test(h) && !/\bnoms?\b/.test(h)) return { kind: "firstName" };
  if (/\b(tel|telephone|phone|portable|mobile)\b/.test(h)) return { kind: "phone" };
  if (/\b(tables?)\b/.test(h)) return { kind: "table" };
  if (/\b(remarques?|commentaires?|notes?|allergies?|regimes?|infos?)\b/.test(h)) return { kind: "note" };
  if (/\b(paye|payee|regle|reglee|paiement|acompte)\b/.test(h)) return { kind: "prepaid" };
  const hw = words(header);
  // Le tarif qui partage le plus de mots : « Enfants (-12 ans) » va à
  // « Enfant », pas à « Moins de 3 ans » qui ne partage que « ans ».
  const score = (t: { name: string }) => words(t.name).filter((w) => hw.includes(w)).length;
  const tariff = tariffs.reduce<(typeof tariffs)[number] | null>(
    (best, t) => (score(t) > (best ? score(best) : 0) ? t : best),
    null,
  );
  if (tariff) return { kind: "tariff", productId: tariff.productId };
  if (/\b(noms?|names?|familles?|clients?)\b/.test(h)) return { kind: "name" };
  return null;
}

const YES = /^(oui|o|x|1|yes|y|vrai|true|ok|paye|payee|regle|reglee)$/;

export function parseReservationCsv(raw: string, tariffs: { productId: string; name: string }[]): CsvResult {
  const text = raw.replace(/^\uFEFF/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = [";", ",", "\t"].reduce((best, s) =>
    firstLine.split(s).length > firstLine.split(best).length ? s : best,
  );
  const [header = [], ...lines] = splitCsv(text, sep);
  const cols = header.map((h) => column(h, tariffs));
  const ignored = header.filter((h, i) => cols[i] === null && h.trim() !== "");
  const errors: CsvResult["errors"] = [];
  if (!cols.some((c) => c?.kind === "name")) {
    return { rows: [], ignored, errors: [{ line: 1, message: "Colonne « Nom » introuvable dans la première ligne" }] };
  }
  if (!cols.some((c) => c?.kind === "tariff")) {
    const names = tariffs.map((t) => `« ${t.name} »`).join(", ");
    return { rows: [], ignored, errors: [{ line: 1, message: `Aucune colonne de tarif (${names}) dans la première ligne` }] };
  }

  const rows: ParsedReservation[] = [];
  lines.forEach((cells, i) => {
    const line = i + 2;
    if (cells.every((c) => c.trim() === "")) return;
    const r: ParsedReservation = { name: "", counts: {}, prepaid: false };
    const notes: string[] = [];
    let bad: string | null = null;
    cols.forEach((col, j) => {
      const v = (cells[j] ?? "").trim();
      if (!col || v === "") return;
      if (col.kind === "name") r.name = [v, r.name].filter(Boolean).join(" ");
      else if (col.kind === "firstName") r.name = [r.name, v].filter(Boolean).join(" ");
      else if (col.kind === "phone") r.phone = v;
      else if (col.kind === "table") r.table = v;
      // Plusieurs colonnes (Remarque, Allergies) : accolées, préfixées par leur en-tête.
      else if (col.kind === "note") notes.push(cols.filter((c) => c?.kind === "note").length > 1 ? `${header[j].trim()} : ${v}` : v);
      else if (col.kind === "prepaid") r.prepaid = YES.test(normalizeName(v));
      else if (!/^\d{1,3}$/.test(v)) bad = `« ${v} » n'est pas un nombre de personnes`;
      else if (col.kind === "tariff" && Number(v) > 0) r.counts[col.productId] = (r.counts[col.productId] ?? 0) + Number(v);
    });
    if (!r.name) bad ??= "nom manquant";
    else if (Object.keys(r.counts).length === 0) bad ??= "aucune personne";
    if (bad) errors.push({ line, message: `${r.name || "?"} : ${bad}` });
    else
      rows.push({
        ...r,
        name: r.name.slice(0, 120),
        phone: r.phone?.slice(0, 40),
        table: r.table?.slice(0, 20),
        note: notes.length ? notes.join(" · ").slice(0, 200) : undefined,
      });
  });
  return { rows, errors, ignored };
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
