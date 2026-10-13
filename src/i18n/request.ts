import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "./config";

export default getRequestConfig(async () => {
  const store = await cookies();
  const fromCookie = store.get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(fromCookie) ? fromCookie : defaultLocale;

  const messages = (await import(`../../messages/${locale}.json`)).default;
  const fallback = locale === "en" ? messages : (await import("../../messages/en.json")).default;

  return {
    locale,
    messages: { ...fallback, ...messages },
    timeZone: "Asia/Kolkata",
  };
});
