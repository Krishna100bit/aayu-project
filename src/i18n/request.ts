import { getRequestConfig } from "next-intl/server";
import { type Locale } from "./config";

export default getRequestConfig(async () => {
  // English is set permanently across the application
  const locale: Locale = "en";

  const messages = (await import(`../../messages/${locale}.json`)).default;
  const fallback = messages;

  return {
    locale,
    messages: { ...fallback, ...messages },
    timeZone: "Asia/Kolkata",
  };
});
