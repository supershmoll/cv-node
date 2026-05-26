import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { AvailabilityStatus } from "src/graphql";
import { AvailabilityIntentService } from "src/ai/availability-intent.service";
import { AvailabilityService } from "src/availability/availability.service";
import { BotLinkService } from "../bot-link.service";
import { DailyStatusService } from "../daily-status.service";
import { ChatLinkModel, ChatPlatform } from "../model/chat-link.model";
import {
  TelegramCallbackQuery,
  TelegramMessage,
  TelegramUpdate,
} from "./telegram.types";
import { TelegramApiService } from "./telegram-api.service";
import { buildStatusKeyboard, buildLanguageKeyboard } from "./telegram-messages";
import type { BotLocale } from "./i18n/bot-locale";
import { resolveBotLocale } from "./i18n/bot-locale";
import {
  parseRequestedLocale,
  translateBotMessage,
  translateLinkError,
  translateLocaleLabel,
  translateStatusLabel,
} from "./i18n/messages";

@Injectable()
export class TelegramUpdateHandler {
  private readonly logger = new Logger(TelegramUpdateHandler.name);

  constructor(
    private readonly telegramApi: TelegramApiService,
    private readonly botLinkService: BotLinkService,
    private readonly availabilityService: AvailabilityService,
    private readonly dailyStatusService: DailyStatusService,
    private readonly availabilityIntentService: AvailabilityIntentService
  ) {}

  async handleUpdate(update: TelegramUpdate) {
    if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
      return;
    }

    if (update.message?.text) {
      await this.handleMessage(update.message);
    }
  }

  private async handleMessage(message: TelegramMessage) {
    const chatId = String(message.chat.id);
    const text = message.text?.trim() ?? "";
    const languageCode = message.from?.language_code;

    if (text.startsWith("/start")) {
      await this.handleStart(message);
      return;
    }

    const link = await this.botLinkService.findByExternalChat(ChatPlatform.TELEGRAM, chatId);
    const locale = link
      ? await this.botLinkService.syncBotLocale(link, languageCode)
      : resolveBotLocale(languageCode);

    if (!link) {
      await this.telegramApi.sendMessage(
        chatId,
        translateBotMessage(locale, "unauthorized")
      );
      return;
    }

    if (text.startsWith("/status")) {
      await this.sendCurrentStatus(
        chatId,
        link,
        link.user.profile?.full_name ?? link.user.email,
        locale
      );
      return;
    }

    if (text.startsWith("/help")) {
      await this.sendHelp(chatId, locale);
      return;
    }

    if (text.startsWith("/lang") || text.startsWith("/language")) {
      await this.handleLanguageCommand(chatId, link, locale, text);
      return;
    }

    await this.handleNaturalLanguageStatus(chatId, link, text, locale);
  }

  private async handleNaturalLanguageStatus(
    chatId: string,
    link: ChatLinkModel,
    text: string,
    locale: BotLocale
  ) {
    const intent = await this.availabilityIntentService.parse(text, locale);

    if (!intent.status) {
      await this.telegramApi.sendMessage(
        chatId,
        translateBotMessage(locale, "ai.couldNotUnderstand"),
        buildStatusKeyboard(locale)
      );
      return;
    }

    try {
      const availability = await this.availabilityService.setAvailabilityFromBot(
        String(link.userId),
        { status: intent.status }
      );
      await this.dailyStatusService.confirmToday(String(link.userId), intent.status);
      await this.telegramApi.sendMessage(
        chatId,
        translateBotMessage(locale, "statusConfirmed", {
          status: translateStatusLabel(locale, availability.status),
        }),
        buildStatusKeyboard(locale)
      );
    } catch (error) {
      this.logger.error("Failed to update status from natural language", error);
      await this.telegramApi.sendMessage(
        chatId,
        translateBotMessage(locale, "updateFailed")
      );
    }
  }

  private async handleStart(message: TelegramMessage) {
    const chatId = String(message.chat.id);
    const parts = message.text?.trim().split(/\s+/) ?? [];
    const code = parts[1];
    const languageCode = message.from?.language_code;
    const locale = resolveBotLocale(languageCode);

    if (code) {
      try {
        const link = await this.botLinkService.linkChatFromStart(
          ChatPlatform.TELEGRAM,
          chatId,
          code,
          message.from?.username,
          languageCode
        );
        const linkLocale = this.botLinkService.getLinkLocale(link);
        const name = link.user.profile?.full_name ?? link.user.email;
        await this.telegramApi.sendMessage(
          chatId,
          translateBotMessage(linkLocale, "linkedSuccess", { name }),
          buildStatusKeyboard(linkLocale)
        );
      } catch (error) {
        await this.telegramApi.sendMessage(
          chatId,
          this.extractErrorMessage(error, locale)
        );
      }
      return;
    }

    const link = await this.botLinkService.findByExternalChat(ChatPlatform.TELEGRAM, chatId);
    if (link) {
      const linkLocale = await this.botLinkService.syncBotLocale(link, languageCode);
      const name = link.user.profile?.full_name ?? link.user.email;
      await this.telegramApi.sendMessage(
        chatId,
        translateBotMessage(linkLocale, "welcomeBack", { name }),
        buildStatusKeyboard(linkLocale)
      );
      return;
    }

    await this.telegramApi.sendMessage(
      chatId,
      translateBotMessage(locale, "unauthorized")
    );
  }

  private async handleCallbackQuery(callback: TelegramCallbackQuery) {
    const chatId = String(callback.message?.chat.id ?? callback.from.id);
    const data = callback.data ?? "";
    const languageCode = callback.from.language_code;

    const link = await this.botLinkService.findByExternalChat(ChatPlatform.TELEGRAM, chatId);
    const locale = link
      ? await this.botLinkService.syncBotLocale(link, languageCode)
      : resolveBotLocale(languageCode);

    if (!link) {
      await this.telegramApi.answerCallbackQuery(callback.id);
      await this.telegramApi.sendMessage(
        chatId,
        translateBotMessage(locale, "unauthorized")
      );
      return;
    }

    await this.telegramApi.answerCallbackQuery(callback.id);

    if (data.startsWith("locale:")) {
      const requestedLocale = parseRequestedLocale(data.replace("locale:", ""));
      if (!requestedLocale) {
        await this.telegramApi.sendMessage(
          chatId,
          translateBotMessage(locale, "lang.invalid")
        );
        return;
      }

      const updatedLocale = await this.botLinkService.setBotLocale(link, requestedLocale);
      await this.telegramApi.sendMessage(
        chatId,
        translateBotMessage(updatedLocale, "lang.updated", {
          language: translateLocaleLabel(updatedLocale),
        }),
        buildStatusKeyboard(updatedLocale)
      );
      return;
    }

    if (data === "action:status") {
      await this.sendCurrentStatus(
        chatId,
        link,
        link.user.profile?.full_name ?? link.user.email,
        locale
      );
      return;
    }

    if (data.startsWith("status:")) {
      const status = data.replace("status:", "") as AvailabilityStatus;
      if (!Object.values(AvailabilityStatus).includes(status)) {
        await this.telegramApi.sendMessage(
          chatId,
          translateBotMessage(locale, "unknownStatusOption")
        );
        return;
      }

      try {
        const availability = await this.availabilityService.setAvailabilityFromBot(
          String(link.userId),
          { status }
        );
        await this.dailyStatusService.confirmToday(String(link.userId), status);
        await this.telegramApi.sendMessage(
          chatId,
          translateBotMessage(locale, "statusConfirmed", {
            status: translateStatusLabel(locale, availability.status),
          }),
          buildStatusKeyboard(locale)
        );
      } catch (error) {
        this.logger.error("Failed to update status from Telegram", error);
        await this.telegramApi.sendMessage(
          chatId,
          translateBotMessage(locale, "updateFailed")
        );
      }
    }
  }

  private async sendCurrentStatus(
    chatId: string,
    link: ChatLinkModel,
    name: string,
    locale: BotLocale
  ) {
    const availability = await this.availabilityService.getMyAvailability(String(link.userId));
    const todayCheck = await this.dailyStatusService.getTodayCheck(String(link.userId));
    const statusLabel = translateStatusLabel(locale, availability.status);
    const confirmedToday = todayCheck?.confirmedAt
      ? translateBotMessage(locale, "todayConfirmed", {
          status: translateStatusLabel(
            locale,
            todayCheck.confirmedStatus ?? availability.status
          ),
        })
      : translateBotMessage(locale, "todayNotConfirmed");

    await this.telegramApi.sendMessage(
      chatId,
      translateBotMessage(locale, "currentStatusHeader", {
        name,
        status: statusLabel,
        confirmed: confirmedToday,
      }),
      buildStatusKeyboard(locale)
    );
  }

  private async sendHelp(chatId: string, locale: BotLocale) {
    await this.telegramApi.sendMessage(
      chatId,
      [
        translateBotMessage(locale, "help.line1"),
        translateBotMessage(locale, "help.line2"),
        translateBotMessage(locale, "help.line3"),
        translateBotMessage(locale, "help.line4"),
        translateBotMessage(locale, "help.line5"),
      ].join("\n"),
      buildStatusKeyboard(locale)
    );
  }

  private async handleLanguageCommand(
    chatId: string,
    link: ChatLinkModel,
    locale: BotLocale,
    text: string
  ) {
    const parts = text.trim().split(/\s+/);
    const requestedLocale = parseRequestedLocale(parts[1]);

    if (requestedLocale) {
      const updatedLocale = await this.botLinkService.setBotLocale(link, requestedLocale);
      await this.telegramApi.sendMessage(
        chatId,
        translateBotMessage(updatedLocale, "lang.updated", {
          language: translateLocaleLabel(updatedLocale),
        }),
        buildStatusKeyboard(updatedLocale)
      );
      return;
    }

    await this.telegramApi.sendMessage(
      chatId,
      [
        translateBotMessage(locale, "lang.current", {
          language: translateLocaleLabel(locale),
        }),
        translateBotMessage(locale, "lang.choose"),
      ].join("\n\n"),
      buildLanguageKeyboard(locale)
    );
  }

  private extractErrorMessage(error: unknown, locale: BotLocale) {
    if (error instanceof Error) {
      const response = (error as Error & { response?: string | { message?: string | string[] } })
        .response;
      if (typeof response === "string") {
        return translateLinkError(locale, response);
      }
      if (response && typeof response === "object" && response.message) {
        const message = Array.isArray(response.message)
          ? response.message.join(", ")
          : response.message;
        return translateLinkError(locale, message);
      }
      return translateLinkError(locale, error.message);
    }
    return translateBotMessage(locale, "somethingWentWrong");
  }
}

@Injectable()
export class TelegramBotService implements OnModuleInit {
  private readonly logger = new Logger(TelegramBotService.name);
  private polling = false;
  private offset = 0;

  constructor(
    private readonly telegramApi: TelegramApiService,
    private readonly updateHandler: TelegramUpdateHandler
  ) {}

  async onModuleInit() {
    if (!this.telegramApi.isConfigured()) {
      this.logger.warn("TELEGRAM_BOT_TOKEN is not set — bot is disabled.");
      return;
    }

    if (process.env.TELEGRAM_USE_POLLING === "true") {
      this.polling = true;
      this.logger.log("Telegram bot running in polling mode.");
      void this.pollUpdates();
      return;
    }

    this.logger.log("Telegram bot ready for webhook updates.");
  }

  handleWebhookUpdate(update: TelegramUpdate) {
    return this.updateHandler.handleUpdate(update);
  }

  private async pollUpdates() {
    while (this.polling) {
      try {
        const updates = await this.telegramApi.getUpdates(this.offset);
        for (const update of updates) {
          this.offset = update.update_id + 1;
          await this.updateHandler.handleUpdate(update);
        }
      } catch (error) {
        this.logger.error("Telegram polling failed", error);
        await this.sleep(3000);
      }

      await this.sleep(500);
    }
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
