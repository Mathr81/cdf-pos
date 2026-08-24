import { createHash } from "node:crypto";
import { mkdir, rename, unlink, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { env } from "./env.js";

/**
 * ─────────────────────────────────────────────────────────────
 *  Traitement des images produit
 * ─────────────────────────────────────────────────────────────
 *  Deux modes, parce qu'aucun réglage unique ne convient aux deux usages
 *  (mesures faites à 320x320 sur ce projet) :
 *
 *    | entrée   | sans perte | q80      |
 *    |----------|------------|----------|
 *    | photo    | 228 934 o  |  36 160 o|
 *    | logo     |   1 864 o  |   3 222 o|
 *
 *  Sur une photo, le sans-perte est 6,3x plus lourd. Sur un aplat net, il est
 *  1,7x plus LÉGER que le q80, et sans artefact de compression sur les bords.
 *  Chaque mode est donc meilleur sur les deux critères dans son domaine.
 *
 *  La sortie est TOUJOURS du WebP. Ce n'est pas qu'une règle de style :
 *  `sharp.format.svg.output` vaut `{file:false, buffer:false, stream:false}`,
 *  sharp est structurellement incapable d'émettre du SVG. Et comme le nom de
 *  fichier est le hash du buffer de SORTIE de sharp, il n'existe aucun chemin
 *  de code par lequel un octet d'entrée atteindrait le disque tel quel.
 */

export type MediaMode = "photo" | "icone";

/** Côté long de la sortie. Couvre 144px CSS en 2x sur iPad avec de la marge. */
const TARGET = 320;

/**
 * Plafond de rastérisation d'une entrée vectorielle. 6,4x la cible, de quoi
 * laisser `contain` travailler sur un logo très allongé sans jamais dépasser
 * 4,2 Mpx en mémoire intermédiaire (environ 17 Mo en RGBA).
 */
const MAX_RENDER_DIM = 2048;

/** Filet de sécurité pour les entrées raster. Le vectoriel est borné en amont. */
const LIMIT_INPUT_PIXELS = 40_000_000;

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export class MediaError extends Error {}

/* ─── Étape 2 : reconnaissance du format par les octets ──────────────
   Le `content-type` et le nom de fichier envoyés par le client ne sont
   jamais utilisés pour décider quoi que ce soit. */

type Detected = "png" | "jpeg" | "webp" | "gif" | "avif" | "svg";

function detectFormat(buf: Buffer): Detected | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP")
    return "webp";
  if (buf.toString("ascii", 0, 3) === "GIF") return "gif";
  if (buf.toString("ascii", 4, 8) === "ftyp") {
    const brand = buf.toString("ascii", 8, 12);
    if (brand.startsWith("avif") || brand.startsWith("avis") || brand.startsWith("mif1"))
      return "avif";
  }
  // SVG : soit gzippé (.svgz), soit du XML en clair.
  if (buf[0] === 0x1f && buf[1] === 0x8b) return "svg";
  const head = buf.toString("utf8", 0, Math.min(buf.length, 4096)).trimStart();
  if (head.startsWith("<?xml") || head.startsWith("<svg") || head.includes("<svg")) return "svg";
  return null;
}

/* ─── Étape 3 : garde-fous propres au vectoriel ──────────────────── */

/**
 * Défense en profondeur sur les entités externes.
 *
 * Vérifié sur librsvg 2.62 (dev win32-x64 et binaire linux-x64 de prod) :
 * une entité externe n'est pas résolue, elle fait échouer le parsing XML
 * (« Entity 'xxe' not defined »), et aucune ressource distante n'est chargée
 * (testé avec un serveur HTTP témoin : zéro requête reçue pour `<image href>`,
 * `<use href>`, `@import url()` et `fill="url(http://…)"`).
 *
 * On rejette quand même en amont, pour que la garantie ne dépende pas du
 * comportement par défaut d'une version future de la bibliothèque.
 */
function rejectXmlEntities(buf: Buffer): void {
  // Un .svgz doit être refusé ici : on ne sait pas inspecter son contenu sans
  // le décompresser, et on n'a pas besoin de ce format.
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    throw new MediaError("SVG compressé (.svgz) non accepté, envoie un .svg");
  }
  const text = buf.toString("utf8");
  if (/<!DOCTYPE/i.test(text) || /<!ENTITY/i.test(text)) {
    throw new MediaError("SVG refusé : déclaration DOCTYPE ou ENTITY interdite");
  }
}

/**
 * Densité de rendu qui borne le raster AVANT toute tentative de rastérisation.
 *
 * La lecture d'en-tête avec `limitInputPixels: false` n'alloue aucun pixel :
 * libvips interroge `rsvg_handle_get_intrinsic_dimensions`. Mesuré à 1-3 ms
 * même sur un SVG de 146 octets déclarant 1,3x10^11 pixels.
 *
 * Sans ce calcul, `limitInputPixels` rejetterait certes la bombe (il agit lui
 * aussi au niveau de l'en-tête), mais il rejetterait AUSSI les grands SVG
 * légitimes au lieu de les rendre correctement.
 */
async function svgDensity(buf: Buffer): Promise<number> {
  const meta = await sharp(buf, { limitInputPixels: false }).metadata();
  const biggest = Math.max(meta.width ?? 0, meta.height ?? 0);
  if (!biggest) throw new MediaError("SVG sans dimensions exploitables");
  const scale = Math.min(1, MAX_RENDER_DIM / biggest);
  return Math.max(1, 72 * scale);
}

/* ─── Étapes 4 à 6 : traitement, encodage, écriture ──────────────── */

export interface ProcessResult {
  imageKey: string;
  width: number;
  height: number;
  bytes: number;
  mode: MediaMode;
}

/**
 * Les quatre coins sont-ils transparents ?
 *
 * C'est la condition qui autorise le rognage. `sharp().trim()` déduit la
 * couleur de fond du pixel du coin : si ce coin est OPAQUE, il fait partie du
 * dessin et le rognage détruit du contenu. Mesuré sur une plaque violette
 * pleine avec un disque au centre : 300x300 ramené à 130x130 et 95 % des
 * pixels violets supprimés.
 *
 * Un coin transparent est en revanche indubitablement du vide. Un dessin qui
 * touche les quatre bords depuis un fond transparent reste intact, la boîte
 * englobante couvrant alors tout le cadre (vérifié).
 */
async function cornersAreTransparent(buf: Buffer, density: number | undefined): Promise<boolean> {
  const { data, info } = await sharp(buf, {
    ...(density !== undefined ? { density } : {}),
    limitInputPixels: LIMIT_INPUT_PIXELS,
    animated: false,
  })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.channels < 4 || info.width < 2 || info.height < 2) return false;
  const alphaAt = (x: number, y: number) => data[(y * info.width + x) * info.channels + 3];
  const corners = [
    alphaAt(0, 0),
    alphaAt(info.width - 1, 0),
    alphaAt(0, info.height - 1),
    alphaAt(info.width - 1, info.height - 1),
  ];
  return corners.every((a) => a < 16);
}

async function encode(buf: Buffer, mode: MediaMode, density: number | undefined) {
  const base = () =>
    sharp(buf, {
      ...(density !== undefined ? { density } : {}),
      limitInputPixels: LIMIT_INPUT_PIXELS,
      animated: false,
    }).rotate(); // applique l'orientation EXIF : sans ça, une photo iPad sort couchée

  if (mode === "icone") {
    // Normalisation du cadrage. `fit: "contain"` ajuste le CADRE du fichier,
    // pas le DESSIN : les exports de logo embarquent des marges internes très
    // variables, et deux logos identiques exportés différemment sortaient à
    // 100 % et 70 % du cadre. Rogner d'abord ramène tout le monde au même
    // référentiel, le dessin lui-même.
    //
    // Uniquement si les coins sont transparents : voir cornersAreTransparent().
    // Un logo aplati sur fond opaque n'est donc pas normalisé, et c'est le
    // réglage de zoom (stocké par produit) qui permet de le rattraper.
    let pipeline = base();
    if (await cornersAreTransparent(buf, density)) {
      // `trim()` calcule une boîte englobante indépendante par côté : une marge
      // de 20 à gauche et 220 à droite est correctement traitée (vérifié).
      pipeline = pipeline.trim({ threshold: 10 });
    }

    // `contain` centre au lieu de rogner, le fond transparent laisse voir la
    // couleur du ticket derrière le logo. Sans perte : plus léger ET plus net
    // qu'un encodage avec perte sur des aplats.
    return pipeline
      .resize(TARGET, TARGET, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        withoutEnlargement: false,
      })
      .webp({ lossless: true, effort: 4 })
      .toBuffer();
  }
  const pipeline = base();
  // `position: "attention"` cadre sur la zone de plus forte entropie : sur une
  // photo de plat, ça vise le plat plutôt que le centre géométrique.
  return pipeline
    .resize(TARGET, TARGET, { fit: "cover", position: "attention" })
    .webp({ quality: 80, effort: 5 })
    .toBuffer();
}

/** Aucun pixel visible ? Sert à refuser une image entièrement transparente. */
async function isBlank(webp: Buffer): Promise<boolean> {
  const { data, info } = await sharp(webp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 3; i < data.length; i += info.channels) if (data[i] > 16) return false;
  return true;
}

/** Suggestion de mode, seulement pour présélectionner le bouton côté UI. */
export async function suggestMode(buf: Buffer): Promise<MediaMode> {
  const format = detectFormat(buf);
  if (format === "svg") return "icone";
  try {
    // `stats().isOpaque` inspecte les pixels réels. `metadata().hasAlpha` ne
    // regarde que l'en-tête et se trompe sur un PNG RGBA entièrement opaque
    // (une capture d'écran serait classée « icône » et partirait en sans-perte).
    const stats = await sharp(buf, { limitInputPixels: LIMIT_INPUT_PIXELS }).stats();
    return stats.isOpaque ? "photo" : "icone";
  } catch {
    return "photo";
  }
}

export async function processUpload(buf: Buffer, mode: MediaMode): Promise<ProcessResult> {
  // Étape 1 : taille brute (multipart plafonne déjà, ceinture et bretelles).
  if (buf.length === 0) throw new MediaError("Fichier vide");
  if (buf.length > MAX_UPLOAD_BYTES) throw new MediaError("Fichier trop volumineux (max 8 Mo)");

  // Étape 2 : format déduit des octets.
  const format = detectFormat(buf);
  if (!format) throw new MediaError("Format non reconnu (PNG, JPEG, WebP, GIF, AVIF ou SVG)");

  // Étape 3 : garde-fous vectoriels.
  let density: number | undefined;
  if (format === "svg") {
    rejectXmlEntities(buf);
    density = await svgDensity(buf);
  }

  // Étapes 4 et 5 : décodage, traitement, encodage WebP.
  let out: Buffer;
  try {
    out = await encode(buf, mode, density);
  } catch (e) {
    throw new MediaError(`Image illisible : ${(e as Error).message}`);
  }

  // Une image sans aucun pixel visible produirait une vignette vide, stockée et
  // sauvegardée pour rien. Le cas devient plus probable avec le rognage.
  if (mode === "icone" && (await isBlank(out))) {
    throw new MediaError("Image vide : aucun pixel visible après traitement");
  }

  // Étape 6 : nom = hash du buffer de SORTIE, écriture atomique.
  const imageKey = createHash("sha256").update(out).digest("hex").slice(0, 32) + ".webp";
  const dir = env.mediaDir;
  await mkdir(dir, { recursive: true });
  const target = join(dir, imageKey);
  const tmp = `${target}.${process.pid}.tmp`;
  try {
    await writeFile(tmp, out);
    await rename(tmp, target);
  } catch (e) {
    await unlink(tmp).catch(() => {});
    throw e;
  }

  const meta = await sharp(out).metadata();
  return {
    imageKey,
    width: meta.width ?? TARGET,
    height: meta.height ?? TARGET,
    bytes: out.length,
    mode,
  };
}

/** Une clé valide est un hash de 32 hex + ".webp". Bloque toute traversée. */
const KEY_RE = /^[a-f0-9]{32}\.webp$/;

export function isValidKey(key: string): boolean {
  return KEY_RE.test(key);
}

export function mediaPath(key: string): string {
  if (!isValidKey(key)) throw new MediaError("Clé invalide");
  return join(env.mediaDir, key);
}

/** Vide le dossier média. Appelé par la remise à zéro « tout effacer ». */
export async function purgeMedia(): Promise<number> {
  let removed = 0;
  const files = await readdir(env.mediaDir).catch(() => [] as string[]);
  for (const f of files) {
    if (!f.endsWith(".webp") && !f.endsWith(".tmp")) continue;
    await unlink(join(env.mediaDir, f)).catch(() => {});
    removed++;
  }
  return removed;
}
