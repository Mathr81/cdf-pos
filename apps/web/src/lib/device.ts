/** Identité persistante de l'appareil + compteur de séquence local. */

const DEVICE_KEY = "cdf.deviceId";
const SEQ_KEY = "cdf.clientSeq";

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

/** Renvoie une séquence locale strictement croissante (ordre d'émission). */
export function nextClientSeq(): number {
  const next = Number(localStorage.getItem(SEQ_KEY) ?? "0") + 1;
  localStorage.setItem(SEQ_KEY, String(next));
  return next;
}

export function newId(): string {
  return crypto.randomUUID();
}
