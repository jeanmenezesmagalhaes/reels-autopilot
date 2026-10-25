import { cookies, headers } from "next/headers";
import { dictionaries, LOCALES, type Locale } from "./dictionaries";

export const LOCALE_COOKIE = "lang";

// Saved choice first, then the browser's Accept-Language, then English.
export async function getLocale(): Promise<Locale> {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (saved && (LOCALES as string[]).includes(saved)) return saved as Locale;
  const accept = (await headers()).get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const base = part.split(";")[0].trim().slice(0, 2).toLowerCase();
    if ((LOCALES as string[]).includes(base)) return base as Locale;
  }
  return "en";
}

export async function getDictionary() {
  const locale = await getLocale();
  return { locale, t: dictionaries[locale] };
}

export { dictionaries, LOCALES, type Locale };
