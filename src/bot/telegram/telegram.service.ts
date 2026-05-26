import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { AvailabilityStatus } from "src/graphql";
import { AvailabilityService } from "src/availability/availability.service";
import { BotLinkService } from "../bot-link.service";
import { DailyStatusService } from "../daily-status.service";
import { ChatPlatform } from "../model/chat-link.model";
import { STATUS_LABELS, UNAUTHORIZED_BOT_MESSAGE } from "../bot.constants";
import {
  TelegramCallbackQuery,
  TelegramMessage,
  TelegramUpdate,
} from "./telegram.types";
import { TelegramApiService } from "./telegram-api.service";
import { buildStatusKeyboard } from "./telegram-messages";

@Injectable()
export class TelegramUpdateHandler {
  private readonly logger = new Logger(TelegramUpdateHandler.name);

  constructor(
    private readonly telegramApi: TelegramApiService,
    private readonly botLinkService: BotLinkService,
    private readonly availabilityService: AvailabilityService,
    private readonly dailyStatusService: DailyStatusService
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

    if (text.startsWith("/start")) {
      await this.handleStart(message);
      return;
    }

    const link = await this.botLinkService.findByExternalChat(ChatPlatform.TELEGRAM, chatId);
    if (!link) {
      await this.telegramApi.sendMessage(chatId, UNAUTHORIZED_BOT_MESSAGE);
      return;
    }

    if (text.startsWith("/status")) {
      await this.sendCurrentStatus(chatId, link.userId, link.user.profile?.full_name ?? link.user.email);
      return;
    }

    if (text.startsWith("/help")) {
      await this.sendHelp(chatId);
      return;
    }

    await this.telegramApi.sendMessage(chatId, "Use the buttons below to confirm today's status.", buildStatusKeyboard());
  }

  private async handleStart(message: TelegramMessage) {
    const chatId = String(message.chat.id);
    const parts = message.text?.trim().split(/\s+/) ?? [];
    const code = parts[1];

    if (code) {
      try {
        const link = await this.botLinkService.linkChatFromStart(
          ChatPlatform.TELEGRAM,
          chatId,
          code,
          message.from?.username
        );
        const name = link.user.profile?.full_name ?? link.user.email;
        await this.telegramApi.sendMessage(
          chatId,
          `Telegram linked to ${name}. You will receive daily status prompts at 9:00 MSK.`,
          buildStatusKeyboard()
        );
      } catch (error) {
        await this.telegramApi.sendMessage(chatId, this.extractErrorMessage(error));
      }
      return;
    }

    const link = await this.botLinkService.findByExternalChat(ChatPlatform.TELEGRAM, chatId);
    if (link) {
      const name = link.user.profile?.full_name ?? link.user.email;
      await this.telegramApi.sendMessage(
        chatId,
        `Welcome back, ${name}. Confirm today's status:`,
        buildStatusKeyboard()
      );
      return;
    }

    await this.telegramApi.sendMessage(chatId, UNAUTHORIZED_BOT_MESSAGE);
  }

  private async handleCallbackQuery(callback: TelegramCallbackQuery) {
    const chatId = String(callback.message?.chat.id ?? callback.from.id);
    const data = callback.data ?? "";

    const link = await this.botLinkService.findByExternalChat(ChatPlatform.TELEGRAM, chatId);
    if (!link) {
      await this.telegramApi.answerCallbackQuery(callback.id);
      await this.telegramApi.sendMessage(chatId, UNAUTHORIZED_BOT_MESSAGE);
      return;
    }

    await this.telegramApi.answerCallbackQuery(callback.id);

    if (data === "action:status") {
      await this.sendCurrentStatus(
        chatId,
        link.userId,
        link.user.profile?.full_name ?? link.user.email
      );
      return;
    }

    if (data.startsWith("status:")) {
      const status = data.replace("status:", "") as AvailabilityStatus;
      if (!Object.values(AvailabilityStatus).includes(status)) {
        await this.telegramApi.sendMessage(chatId, "Unknown status option.");
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
          `Status confirmed for today: ${STATUS_LABELS[availability.status]}.`,
          buildStatusKeyboard()
        );
      } catch (error) {
        this.logger.error("Failed to update status from Telegram", error);
        await this.telegramApi.sendMessage(
          chatId,
          "Could not update status. Try again in a few seconds."
        );
      }
    }
  }

  private async sendCurrentStatus(chatId: string, userId: string, name: string) {
    const availability = await this.availabilityService.getMyAvailability(String(userId));
    const todayCheck = await this.dailyStatusService.getTodayCheck(String(userId));
    const confirmedToday = todayCheck?.confirmedAt
      ? `\nToday confirmed: ${STATUS_LABELS[todayCheck.confirmedStatus ?? availability.status]}`
      : "\nToday's status is not confirmed yet.";

    await this.telegramApi.sendMessage(
      chatId,
      `${name}\nCurrent status: ${STATUS_LABELS[availability.status]}${confirmedToday}`,
      buildStatusKeyboard()
    );
  }

  private async sendHelp(chatId: string) {
    await this.telegramApi.sendMessage(
      chatId,
      [
        "This bot is linked to your HRM account.",
        "Choose a status button before 12:00 MSK each day.",
        "/status - show current status",
      ].join("\n"),
      buildStatusKeyboard()
    );
  }

  private extractErrorMessage(error: unknown) {
    if (error instanceof Error) {
      const response = (error as Error & { response?: string | { message?: string | string[] } })
        .response;
      if (typeof response === "string") {
        return response;
      }
      if (response && typeof response === "object" && response.message) {
        return Array.isArray(response.message)
          ? response.message.join(", ")
          : response.message;
      }
      return error.message;
    }
    return "Something went wrong.";
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
