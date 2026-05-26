export type BotLocale = "en" | "ru";

export const DEFAULT_BOT_LOCALE: BotLocale = "en";

export function resolveBotLocale(languageCode?: string | null): BotLocale {
  if (!languageCode) {
    return DEFAULT_BOT_LOCALE;
  }

  const normalized = languageCode.toLowerCase();
  if (normalized === "ru" || normalized.startsWith("ru-")) {
    return "ru";
  }

  return DEFAULT_BOT_LOCALE;
}
