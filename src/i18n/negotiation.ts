import { defaultLocale, isLocale, type Locale } from "./config";

/** Picks the best supported locale from an Accept-Language header. */
export function pickLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return defaultLocale;
  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return {
        tag: tag.toLowerCase(),
        q: q ? Number.parseFloat(q.slice(2)) : 1,
      };
    })
    .filter((e) => e.tag && !Number.isNaN(e.q))
    .sort((a, b) => b.q - a.q);
  for (const { tag } of ranked) {
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return defaultLocale;
}
