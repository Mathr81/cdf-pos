/**
 * « iPad · Safari », « Android SM-X200 · Chrome » : de quoi reconnaître un
 * poste dans la liste des postes connectés (Admin).
 *
 * Apple ne livre jamais le modèle exact d'un iPad ou d'un iPhone, et iPadOS
 * se présente comme un Mac : seul l'écran tactile le trahit. Sur Android, le
 * modèle n'est plus dans le user-agent de Chrome (« K » à la place) ; on le
 * demande à part, une fois, et il s'ajoute dès qu'il est connu.
 */
let model: string | undefined;
// globalThis : ce module est aussi chargé par les tests, hors navigateur.
const uaData = (
  globalThis.navigator as { userAgentData?: { getHighEntropyValues(h: string[]): Promise<{ model?: string }> } } | undefined
)?.userAgentData;
uaData
  ?.getHighEntropyValues(["model"])
  .then((v) => {
    model = v.model || undefined;
  })
  .catch(() => {});

export function describeDevice(): string {
  const installed =
    window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
  return describeUserAgent(navigator.userAgent, navigator.maxTouchPoints, model) + (installed ? " · app installée" : "");
}

export function describeUserAgent(ua: string, touchPoints: number, model?: string): string {
  const androidModel = model ?? ua.match(/Android [\d.]+; ([^;)]+?)(?: Build|\))/)?.[1];
  const device =
    /iPad/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)
      ? "iPad"
      : /iPhone/.test(ua)
        ? "iPhone"
        : /Android/.test(ua)
          ? ["Android", androidModel !== "K" && androidModel].filter(Boolean).join(" ")
          : /CrOS/.test(ua)
            ? "Chromebook"
            : /Windows/.test(ua)
              ? "Windows"
              : /Macintosh/.test(ua)
                ? "Mac"
                : /Linux/.test(ua)
                  ? "Linux"
                  : "Appareil inconnu";
  // L'ordre compte : Edge, Opera et Samsung Internet disent tous aussi « Chrome » et « Safari ».
  const browser = /EdgA?\/|EdgiOS\//.test(ua)
    ? "Edge"
    : /SamsungBrowser\//.test(ua)
      ? "Samsung Internet"
      : /OPR\//.test(ua)
        ? "Opera"
        : /Firefox\/|FxiOS\//.test(ua)
          ? "Firefox"
          : /CriOS\/|Chrome\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : "navigateur inconnu";
  return `${device} · ${browser}`;
}
