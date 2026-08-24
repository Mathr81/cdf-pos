/**
 * Réduction d'une image avant envoi.
 * ─────────────────────────────────────────────────────────────
 * Une photo prise à l'iPad et convertie en JPEG par Safari pèse
 * régulièrement entre 5 et 15 Mo, pour un capteur qui peut monter à 48 Mpx.
 * L'envoyer telle quelle sur le wifi d'une salle des fêtes est long, et
 * inutile : le serveur la ramène de toute façon à 320x320.
 *
 * On la réduit donc ici, à un côté long de 1600 px, soit cinq fois la cible.
 * Aucune perte visible après la réduction finale côté serveur.
 *
 * Deux cas sont laissés intacts :
 *   - le SVG, qui est vectoriel et doit être rastérisé par le serveur, sous
 *     le garde-fou de densité ;
 *   - les images déjà petites, pour que le mode icône sans perte reçoive les
 *     pixels d'origine et non un ré-encodage.
 */

/** Au-delà, on réduit. En deçà, le fichier part tel quel. */
const MAX_DIM = 1600;
const MAX_BYTES = 1.5 * 1024 * 1024;

function isVector(file: File): boolean {
  return file.type === "image/svg+xml" || /\.svgz?$/i.test(file.name);
}

async function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  // WebP conserve la transparence et pèse bien moins qu'un PNG. Repli PNG si
  // le navigateur ne sait pas l'encoder (le repli JPEG est exclu : il
  // aplatirait la transparence d'un logo).
  for (const type of ["image/webp", "image/png"]) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, type, 0.92),
    );
    if (blob && blob.type === type) return blob;
  }
  return null;
}

/**
 * Renvoie un fichier réduit, ou le fichier d'origine si la réduction n'est ni
 * nécessaire ni possible. Ne lève jamais : en cas d'échec on laisse le serveur
 * faire, il a ses propres limites.
 */
export async function downscaleForUpload(file: File): Promise<File> {
  if (isVector(file)) return file;
  if (file.size <= MAX_BYTES) return file;
  if (typeof createImageBitmap !== "function") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    if (longest <= MAX_DIM) {
      bitmap.close?.();
      return file;
    }

    const scale = MAX_DIM / longest;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const blob = await toBlob(canvas);
    if (!blob || blob.size >= file.size) return file;

    const ext = blob.type === "image/webp" ? "webp" : "png";
    return new File([blob], `upload.${ext}`, { type: blob.type });
  } catch {
    // Format non décodable par le navigateur (certains HEIC par exemple) :
    // on laisse partir l'original, le serveur saura peut-être le lire.
    return file;
  }
}
