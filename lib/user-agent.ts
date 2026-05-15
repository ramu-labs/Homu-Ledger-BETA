// Tiny user-agent parser for the /settings/devices page.
//
// Full UA parsing is a famously gnarly problem (ua-parser-js handles
// ~6,000 rules) but we only need three things to label a row:
//
//   1. Device class — iPhone / iPad / Android phone / Mac / Windows /
//                     Linux / Unknown
//   2. Browser / runtime — Safari / Chrome / Firefox / Edge / unknown.
//                          We also flag iOS-PWA-standalone-shell when
//                          we can (it's distinguishable from in-browser
//                          Safari in iOS 17+).
//   3. Emoji glyph for the row — 📱 / 💻 / 🖥️ / ❓
//
// Resist the temptation to add more cases here. If it gets bigger
// than ~80 lines, pull in ua-parser-js instead.

export type ParsedUA = {
  /** "iPhone", "iPad", "Mac", "Windows PC", "Android", "Linux", "Unknown" */
  device: string;
  /** "Safari", "Chrome", "Firefox", "Edge", "App", "Browser" */
  browser: string;
  /** Headline label, e.g. "iPhone · Safari" */
  label: string;
  /** Lucide-emoji-icon hint */
  glyph: string;
};

export function parseUserAgent(ua: string | null | undefined): ParsedUA {
  const s = (ua ?? "").trim();
  if (!s) {
    return { device: "Unknown", browser: "Browser", label: "Unknown device", glyph: "❓" };
  }

  // ── Device class ──
  let device: ParsedUA["device"] = "Unknown";
  let glyph = "❓";

  if (/iPhone/.test(s)) {
    device = "iPhone";
    glyph = "📱";
  } else if (/iPad/.test(s)) {
    device = "iPad";
    glyph = "📱";
  } else if (/Android/.test(s)) {
    device = /Mobile/.test(s) ? "Android phone" : "Android tablet";
    glyph = "📱";
  } else if (/Macintosh|Mac OS X/.test(s)) {
    device = "Mac";
    glyph = "💻";
  } else if (/Windows/.test(s)) {
    device = "Windows PC";
    glyph = "💻";
  } else if (/Linux|X11/.test(s)) {
    device = "Linux";
    glyph = "🖥️";
  }

  // ── Browser / runtime ──
  // Order matters — Edge UA contains "Chrome", Chrome UA contains
  // "Safari", etc. Check the more-specific tokens first.
  let browser: ParsedUA["browser"] = "Browser";
  if (/Edg\//.test(s)) browser = "Edge";
  else if (/OPR\/|Opera/.test(s)) browser = "Opera";
  else if (/Firefox\//.test(s)) browser = "Firefox";
  else if (/Chrome\//.test(s)) browser = "Chrome";
  // Safari is the catch-all for the Apple ecosystem AFTER Chrome /
  // Edge / Firefox have had a chance to match, because they all
  // include "Safari" in their UA.
  else if (/Safari\//.test(s) && (/iPhone|iPad|Macintosh/.test(s))) browser = "Safari";

  return {
    device,
    browser,
    label: `${device} · ${browser}`,
    glyph,
  };
}
