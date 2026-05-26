import { Injectable, Logger } from "@nestjs/common";
import {
  TelegramReplyMarkup,
  TelegramUpdate,
} from "./telegram.types";

@Injectable()
export class TelegramApiService {
  private readonly logger = new Logger(TelegramApiService.name);
  private readonly token = process.env.TELEGRAM_BOT_TOKEN ?? "";

  isConfigured() {
    return Boolean(this.token);
  }

  async sendMessage(chatId: string, text: string, replyMarkup?: TelegramReplyMarkup) {
    return this.request("sendMessage", {
      chat_id: chatId,
      text,
      reply_markup: replyMarkup,
    });
  }

  async answerCallbackQuery(callbackQueryId: string) {
    return this.request("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
    });
  }

  async getUpdates(offset: number) {
    const result = await this.request<TelegramUpdate[]>("getUpdates", {
      offset,
      timeout: 30,
      allowed_updates: ["message", "callback_query"],
    });

    return result ?? [];
  }

  private async request<T = unknown>(method: string, body?: Record<string, unknown>) {
    if (!this.token) {
      return null;
    }

    const response = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });

    const payload = (await response.json()) as {
      ok: boolean;
      result?: T;
      description?: string;
    };

    if (!payload.ok) {
      this.logger.error(`Telegram API ${method} failed: ${payload.description ?? "unknown"}`);
      throw new Error(payload.description ?? "Telegram API request failed");
    }

    return payload.result ?? null;
  }
}
