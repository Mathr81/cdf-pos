import { describe, expect, test } from "vitest";

import { describeUserAgent } from "./deviceInfo.js";

describe("describeUserAgent", () => {
  test("iPadOS se présente comme un Mac : l'écran tactile le distingue", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
    expect(describeUserAgent(ua, 5)).toBe("iPad · Safari");
    expect(describeUserAgent(ua, 0)).toBe("Mac · Safari");
  });

  test("iPhone, Chrome sur iOS", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1";
    expect(describeUserAgent(ua, 5)).toBe("iPhone · Chrome");
  });

  test("Android : modèle demandé à part, sinon celui du user-agent, jamais « K »", () => {
    const reduced =
      "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
    expect(describeUserAgent(reduced, 5)).toBe("Android · Chrome");
    expect(describeUserAgent(reduced, 5, "SM-X200")).toBe("Android SM-X200 · Chrome");
    const samsung =
      "Mozilla/5.0 (Linux; Android 13; SM-X200 Build/TP1A) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0 Safari/537.36";
    expect(describeUserAgent(samsung, 5)).toBe("Android SM-X200 · Samsung Internet");
  });

  test("Edge et Firefox sur ordinateur", () => {
    expect(
      describeUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Edg/126.0",
        0,
      ),
    ).toBe("Windows · Edge");
    expect(describeUserAgent("Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0", 0)).toBe(
      "Linux · Firefox",
    );
  });
});
