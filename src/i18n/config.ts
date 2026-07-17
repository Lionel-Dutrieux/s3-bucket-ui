export const locales = ["en", "fr", "de", "es", "zh"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const LOCALE_COOKIE = "locale";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
