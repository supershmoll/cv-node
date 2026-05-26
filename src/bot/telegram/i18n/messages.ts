import { AvailabilityStatus } from "src/graphql";
import type { BotLocale } from "./bot-locale";

export type BotMessageKey =
  | "keyboard.office"
  | "keyboard.remote"
  | "keyboard.sickDay"
  | "keyboard.sickList"
  | "keyboard.vacation"
  | "keyboard.myStatus"
  | "keyboard.langEn"
  | "keyboard.langRu"
  | "status.office"
  | "status.remote"
  | "status.sickDay"
  | "status.sickList"
  | "status.vacation"
  | "status.unknown"
  | "morningPrompt"
  | "reminder"
  | "forceLogout"
  | "unauthorized"
  | "useButtonsBelow"
  | "linkedSuccess"
  | "welcomeBack"
  | "unknownStatusOption"
  | "statusConfirmed"
  | "updateFailed"
  | "currentStatusHeader"
  | "todayConfirmed"
  | "todayNotConfirmed"
  | "help.line1"
  | "help.line2"
  | "help.line3"
  | "help.line4"
  | "lang.current"
  | "lang.choose"
  | "lang.updated"
  | "lang.invalid"
  | "somethingWentWrong"
  | "errors.invalidLink"
  | "errors.expiredLink"
  | "errors.usernameRequired"
  | "errors.usernameMismatch";

type MessageParams = Record<string, string | number>;

const MESSAGES: Record<BotLocale, Record<BotMessageKey, string>> = {
  en: {
    "keyboard.office": "Office",
    "keyboard.remote": "Remote",
    "keyboard.sickDay": "Sick day",
    "keyboard.sickList": "Sick leave",
    "keyboard.vacation": "Vacation",
    "keyboard.myStatus": "My status",
    "keyboard.langEn": "English",
    "keyboard.langRu": "Русский",
    "status.office": "In the office",
    "status.remote": "Working remotely",
    "status.sickDay": "Sick day",
    "status.sickList": "On sick leave",
    "status.vacation": "On vacation",
    "status.unknown": "Unknown",
    morningPrompt:
      "Good morning! Please confirm your work status for today before 12:00 (Moscow time):",
    reminder: "Reminder ({hour}:00 MSK): please confirm today's work status before 12:00.",
    forceLogout:
      "Your HRM session was ended because today's status was not confirmed by 12:00 (Moscow time). Log in to the HRM app and confirm your status in this chat.",
    unauthorized:
      "This bot is private. Connect your Telegram account from the HRM app profile first.",
    useButtonsBelow: "Use the buttons below to confirm today's status.",
    linkedSuccess:
      "Telegram linked to {name}. You will receive daily status prompts at 9:00 MSK.",
    welcomeBack: "Welcome back, {name}. Confirm today's status:",
    unknownStatusOption: "Unknown status option.",
    statusConfirmed: "Status confirmed for today: {status}.",
    updateFailed: "Could not update status. Try again in a few seconds.",
    currentStatusHeader: "{name}\nCurrent status: {status}{confirmed}",
    todayConfirmed: "\nToday confirmed: {status}",
    todayNotConfirmed: "\nToday's status is not confirmed yet.",
    "help.line1": "This bot is linked to your HRM account.",
    "help.line2": "Choose a status button before 12:00 MSK each day.",
    "help.line3": "/status — show current status",
    "help.line4": "/lang — change bot language (en / ru)",
    "lang.current": "Current language: {language}",
    "lang.choose": "Choose bot language:",
    "lang.updated": "Language updated to {language}.",
    "lang.invalid": "Use /lang, /lang en, or /lang ru.",
    somethingWentWrong: "Something went wrong.",
    "errors.invalidLink":
      "Invalid or expired connect link. Request a new one in the HRM app.",
    "errors.expiredLink": "Connect link expired. Open Telegram again from the HRM app.",
    "errors.usernameRequired":
      "Your Telegram account must have a public @username. Set one in Telegram settings and try again.",
    "errors.usernameMismatch":
      "This Telegram account (@{actual}) does not match the username entered in the HRM app (@{expected}).",
  },
  ru: {
    "keyboard.office": "В офисе",
    "keyboard.remote": "Удалённо",
    "keyboard.sickDay": "Болею",
    "keyboard.sickList": "На больничном",
    "keyboard.vacation": "В отпуске",
    "keyboard.myStatus": "Мой статус",
    "keyboard.langEn": "English",
    "keyboard.langRu": "Русский",
    "status.office": "В офисе",
    "status.remote": "Удалённо",
    "status.sickDay": "Больной день",
    "status.sickList": "На больничном",
    "status.vacation": "В отпуске",
    "status.unknown": "Неизвестно",
    morningPrompt:
      "Доброе утро! Подтвердите рабочий статус на сегодня до 12:00 (МСК):",
    reminder: "Напоминание ({hour}:00 МСК): подтвердите статус на сегодня до 12:00.",
    forceLogout:
      "Сессия в HRM завершена, так как статус на сегодня не был подтверждён до 12:00 (МСК). Войдите в приложение и подтвердите статус в этом чате.",
    unauthorized:
      "Этот бот закрытый. Сначала подключите Telegram в профиле HRM-приложения.",
    useButtonsBelow: "Используйте кнопки ниже, чтобы подтвердить статус на сегодня.",
    linkedSuccess:
      "Telegram привязан к {name}. Ежедневные запросы статуса приходят в 9:00 МСК.",
    welcomeBack: "С возвращением, {name}. Подтвердите статус на сегодня:",
    unknownStatusOption: "Неизвестный вариант статуса.",
    statusConfirmed: "Статус на сегодня подтверждён: {status}.",
    updateFailed: "Не удалось обновить статус. Попробуйте через несколько секунд.",
    currentStatusHeader: "{name}\nТекущий статус: {status}{confirmed}",
    todayConfirmed: "\nСегодня подтверждено: {status}",
    todayNotConfirmed: "\nСтатус на сегодня ещё не подтверждён.",
    "help.line1": "Этот бот привязан к вашему аккаунту HRM.",
    "help.line2": "Выбирайте статус кнопкой до 12:00 МСК каждый день.",
    "help.line3": "/status — показать текущий статус",
    "help.line4": "/lang — сменить язык бота (en / ru)",
    "lang.current": "Текущий язык: {language}",
    "lang.choose": "Выберите язык бота:",
    "lang.updated": "Язык изменён на {language}.",
    "lang.invalid": "Используйте /lang, /lang en или /lang ru.",
    somethingWentWrong: "Что-то пошло не так.",
    "errors.invalidLink":
      "Недействительная или просроченная ссылка. Запросите новую в приложении HRM.",
    "errors.expiredLink":
      "Ссылка для подключения истекла. Откройте Telegram снова из приложения HRM.",
    "errors.usernameRequired":
      "У аккаунта Telegram должен быть публичный @username. Укажите его в настройках Telegram и попробуйте снова.",
    "errors.usernameMismatch":
      "Этот аккаунт Telegram (@{actual}) не совпадает с именем, указанным в HRM (@{expected}).",
  },
};

const STATUS_MESSAGE_KEYS: Record<AvailabilityStatus, BotMessageKey> = {
  [AvailabilityStatus.OFFICE]: "status.office",
  [AvailabilityStatus.REMOTE]: "status.remote",
  [AvailabilityStatus.SICK_DAY]: "status.sickDay",
  [AvailabilityStatus.SICK_LIST]: "status.sickList",
  [AvailabilityStatus.VACATION]: "status.vacation",
  [AvailabilityStatus.UNKNOWN]: "status.unknown",
};

const LOCALE_LABEL_KEYS: Record<BotLocale, BotMessageKey> = {
  en: "keyboard.langEn",
  ru: "keyboard.langRu",
};

export function translateBotMessage(
  locale: BotLocale,
  key: BotMessageKey,
  params?: MessageParams
): string {
  let message = MESSAGES[locale][key] ?? MESSAGES.en[key];

  if (params) {
    for (const [name, value] of Object.entries(params)) {
      message = message.split(`{${name}}`).join(String(value));
    }
  }

  return message;
}

export function translateStatusLabel(
  locale: BotLocale,
  status: AvailabilityStatus
): string {
  return translateBotMessage(locale, STATUS_MESSAGE_KEYS[status]);
}

export function translateLocaleLabel(locale: BotLocale): string {
  return translateBotMessage(locale, LOCALE_LABEL_KEYS[locale]);
}

export function translateLinkError(locale: BotLocale, message: string): string {
  const matchers: Array<{
    pattern: RegExp;
    key: BotMessageKey;
    params?: (match: RegExpMatchArray) => MessageParams;
  }> = [
    {
      pattern:
        /^This Telegram account \(@(.+)\) does not match the username entered in the HRM app \(@(.+)\)\.$/,
      key: "errors.usernameMismatch",
      params: (match) => ({ actual: match[1], expected: match[2] }),
    },
  ];

  for (const matcher of matchers) {
    const match = message.match(matcher.pattern);
    if (match) {
      return translateBotMessage(locale, matcher.key, matcher.params?.(match));
    }
  }

  const exactMap: Partial<Record<string, BotMessageKey>> = {
    "Invalid or expired connect link. Request a new one in the HRM app.":
      "errors.invalidLink",
    "Connect link expired. Open Telegram again from the HRM app.":
      "errors.expiredLink",
    "Your Telegram account must have a public @username. Set one in Telegram settings and try again.":
      "errors.usernameRequired",
  };

  const key = exactMap[message];
  if (key) {
    return translateBotMessage(locale, key);
  }

  return message;
}

export function parseRequestedLocale(value?: string): BotLocale | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "en" || normalized === "english") {
    return "en";
  }
  if (normalized === "ru" || normalized === "russian" || normalized === "русский") {
    return "ru";
  }

  return null;
}
