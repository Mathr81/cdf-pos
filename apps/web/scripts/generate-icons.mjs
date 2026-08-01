// Génère des icônes PNG (192 & 512) pour la PWA, sans dépendance externe.
// Fond sombre + tuile ambre + "couches de burger" stylisées.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(OUT, { recursive: true });

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function png(size, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixels(x, y, size);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BG = hex("#0b1120");
const AMBER = hex("#f59e0b");
const BUN = hex("#fcd34d");
const PATTY = hex("#7c2d12");
const LETTUCE = hex("#4ade80");

function pixel(x, y, size) {
  const s = size;
  const pad = s * 0.1;
  const r = s * 0.2; // corner radius of tile
  const min = pad;
  const max = s - pad;
  // Inside the padded square?
  let tile = x >= min && x <= max && y >= min && y <= max;
  if (tile) {
    // Nearest corner centre, then carve only if within the corner arc.
    const cx = x < min + r ? min + r : x > max - r ? max - r : x;
    const cy = y < min + r ? min + r : y > max - r ? max - r : y;
    if ((cx !== x || cy !== y) && Math.hypot(x - cx, y - cy) > r) tile = false;
  }
  if (!tile) return [...BG, 255];

  // burger layers within tile
  const top = pad + s * 0.16;
  const h = s - 2 * pad - s * 0.32;
  const rel = (y - top) / h;
  if (rel < 0 || rel > 1) return [...AMBER, 255];
  let col;
  if (rel < 0.28) col = BUN;
  else if (rel < 0.42) col = LETTUCE;
  else if (rel < 0.62) col = PATTY;
  else if (rel < 0.72) col = LETTUCE;
  else col = BUN;
  return [...col, 255];
}

for (const size of [192, 512]) {
  writeFileSync(join(OUT, `icon-${size}.png`), png(size, (x, y) => pixel(x, y, size)));
  console.log(`icon-${size}.png généré`);
}
