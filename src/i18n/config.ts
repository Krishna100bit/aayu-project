export const locales = ["hi", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "hi";
export const LOCALE_COOKIE = "tl_locale";

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (locales as readonly string[]).includes(v);
}
