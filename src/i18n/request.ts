import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { isLocale } from "./config";
import { pickLocale } from "./negotiation";

export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieLocale = store.get("locale")?.value;
  const locale =
    cookieLocale && isLocale(cookieLocale)
      ? cookieLocale
      : pickLocale((await headers()).get("accept-language"));

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
