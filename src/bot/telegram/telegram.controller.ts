import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { Public } from "src/auth/guards/public.decorator";
import { TelegramBotService } from "./telegram.service";
import { TelegramUpdate } from "./telegram.types";

@Controller("api/telegram")
export class TelegramController {
  constructor(private readonly telegramBotService: TelegramBotService) {}

  @Public()
  @Post("webhook")
  @HttpCode(200)
  handleWebhook(
    @Body() update: TelegramUpdate,
    @Headers("x-telegram-bot-api-secret-token") secret?: string
  ) {
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (expectedSecret && secret !== expectedSecret) {
      throw new UnauthorizedException("Invalid Telegram webhook secret");
    }

    void this.telegramBotService.handleWebhookUpdate(update);
    return { ok: true };
  }
}
