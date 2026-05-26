import { AvailabilityStatus } from "src/graphql";
import type { BotLocale } from "./i18n/bot-locale";
import { translateBotMessage } from "./i18n/messages";
import { TelegramReplyMarkup } from "./telegram.types";

export const buildStatusKeyboard = (locale: BotLocale): TelegramReplyMarkup => ({
  inline_keyboard: [
    [
      {
        text: translateBotMessage(locale, "keyboard.office"),
        callback_data: `status:${AvailabilityStatus.OFFICE}`,
      },
      {
        text: translateBotMessage(locale, "keyboard.remote"),
        callback_data: `status:${AvailabilityStatus.REMOTE}`,
      },
    ],
    [
      {
        text: translateBotMessage(locale, "keyboard.sickDay"),
        callback_data: `status:${AvailabilityStatus.SICK_DAY}`,
      },
      {
        text: translateBotMessage(locale, "keyboard.sickList"),
        callback_data: `status:${AvailabilityStatus.SICK_LIST}`,
      },
    ],
    [
      {
        text: translateBotMessage(locale, "keyboard.vacation"),
        callback_data: `status:${AvailabilityStatus.VACATION}`,
      },
    ],
    [{ text: translateBotMessage(locale, "keyboard.myStatus"), callback_data: "action:status" }],
  ],
});

export const buildLanguageKeyboard = (locale: BotLocale): TelegramReplyMarkup => ({
  inline_keyboard: [
    [
      {
        text: translateBotMessage(locale, "keyboard.langEn"),
        callback_data: "locale:en",
      },
      {
        text: translateBotMessage(locale, "keyboard.langRu"),
        callback_data: "locale:ru",
      },
    ],
  ],
});

export const buildMorningPromptText = (locale: BotLocale) =>
  translateBotMessage(locale, "morningPrompt");

export const buildReminderText = (locale: BotLocale, hour: number) =>
  translateBotMessage(locale, "reminder", { hour });

export const buildForceLogoutText = (locale: BotLocale) =>
  translateBotMessage(locale, "forceLogout");
