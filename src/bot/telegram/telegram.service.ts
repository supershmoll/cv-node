import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { AvailabilityStatus } from "src/graphql";
import { AvailabilityService } from "src/availability/availability.service";
import { BotLinkService } from "../bot-link.service";
import { ChatPlatform } from "../model/chat-link.model";
import { STATUS_LABELS } from "../bot.constants";
import {
  TelegramCallbackQuery,
  TelegramMessage,
  TelegramReplyMarkup,
  TelegramUpdate,
} from "./telegram.types";
import { TelegramApiService } from "./telegram-api.service";

@Injectable()
export class TelegramUpdateHandler {
  private readonly logger = new Logger(TelegramUpdateHandler.name);

  constructor(
    private readonly telegramApi: TelegramApiService,
    private readonly botLinkService: BotLinkService,
    private readonly availabilityService: AvailabilityService
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
      await this.sendWelcome(chatId);
      return;
    }

    if (text.startsWith("/link")) {
      const code = text.split(/\s+/)[1];
      if (!code) {
        await this.telegramApi.sendMessage(
          chatId,
          "Usage: /link 123456\nGenerate a code in the HRM app first."
        );
        return;
      }

      try {
        const link = await this.botLinkService.linkChat(
          ChatPlatform.TELEGRAM,
          chatId,
          code
        );
        const name = link.user.profile?.full_name ?? link.user.email;
        await this.telegramApi.sendMessage(
          chatId,
          `Account linked to ${name}. Use the buttons below to update your status.`,
          this.buildStatusKeyboard()
        );
      } catch (error) {
        const messageText = this.extractErrorMessage(error);
        await this.telegramApi.sendMessage(chatId, messageText);
      }
      return;
    }

    if (text.startsWith("/status")) {
      await this.sendCurrentStatus(chatId);
      return;
    }

    if (text.startsWith("/help")) {
      await this.sendHelp(chatId);
      return;
    }

    await this.telegramApi.sendMessage(
      chatId,
      "Unknown command. Try /help or use the menu buttons."
    );
  }

  private async handleCallbackQuery(callback: TelegramCallbackQuery) {
    const chatId = String(callback.message?.chat.id ?? callback.from.id);
    const data = callback.data ?? "";

    await this.telegramApi.answerCallbackQuery(callback.id);

    if (data === "action:status") {
      await this.sendCurrentStatus(chatId);
      return;
    }

    if (data.startsWith("status:")) {
      const status = data.replace("status:", "") as AvailabilityStatus;
      if (!Object.values(AvailabilityStatus).includes(status)) {
        await this.telegramApi.sendMessage(chatId, "Unknown status option.");
        return;
      }

      const link = await this.botLinkService.findByExternalChat(
        ChatPlatform.TELEGRAM,
        chatId
      );

      if (!link) {
        await this.telegramApi.sendMessage(
          chatId,
          "Link your HRM account first with /link <code>."
        );
        return;
      }

      try {
        const availability = await this.availabilityService.setAvailabilityFromBot(
          String(link.userId),
          { status }
        );
        await this.telegramApi.sendMessage(
          chatId,
          `Status updated to ${STATUS_LABELS[availability.status]}.`,
          this.buildStatusKeyboard()
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

  private async sendWelcome(chatId: string) {
    const link = await this.botLinkService.findByExternalChat(
      ChatPlatform.TELEGRAM,
      chatId
    );

    if (link) {
      const name = link.user.profile?.full_name ?? link.user.email;
      await this.telegramApi.sendMessage(
        chatId,
        `Welcome back, ${name}. Choose your current availability:`,
        this.buildStatusKeyboard()
      );
      return;
    }

    await this.telegramApi.sendMessage(
      chatId,
      [
        "Welcome to the HRM availability bot.",
        "",
        "1. Log in to the HRM app and generate a link code.",
        "2. Send /link <code> here (example: /link 482913).",
        "3. Use the buttons to set On shift, Sick, Vacation, etc.",
      ].join("\n")
    );
  }

  private async sendCurrentStatus(chatId: string) {
    const link = await this.botLinkService.findByExternalChat(
      ChatPlatform.TELEGRAM,
      chatId
    );

    if (!link) {
      await this.telegramApi.sendMessage(
        chatId,
        "No linked account. Generate a code in the app, then send /link <code>."
      );
      return;
    }

    const availability = await this.availabilityService.getMyAvailability(String(link.userId));
    const name = link.user.profile?.full_name ?? link.user.email;

    await this.telegramApi.sendMessage(
      chatId,
      `${name}\nCurrent status: ${STATUS_LABELS[availability.status]}`,
      this.buildStatusKeyboard()
    );
  }

  private async sendHelp(chatId: string) {
    await this.telegramApi.sendMessage(
      chatId,
      [
        "Commands:",
        "/start - welcome and menu",
        "/link <code> - connect your HRM account",
        "/status - show current availability",
        "",
        "Or use the inline buttons after linking.",
      ].join("\n"),
      this.buildStatusKeyboard()
    );
  }

  private buildStatusKeyboard(): TelegramReplyMarkup {
    return {
      inline_keyboard: [
        [
          { text: "On shift", callback_data: `status:${AvailabilityStatus.ON_SHIFT}` },
          { text: "Off shift", callback_data: `status:${AvailabilityStatus.OFF_SHIFT}` },
        ],
        [
          { text: "Sick", callback_data: `status:${AvailabilityStatus.SICK}` },
          { text: "Vacation", callback_data: `status:${AvailabilityStatus.VACATION}` },
        ],
        [{ text: "My status", callback_data: "action:status" }],
      ],
    };
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
