import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AvailabilityModule } from "src/availability/availability.module";
import { UsersModule } from "src/users/users.module";
import { BotLinkService } from "./bot-link.service";
import { BotResolver } from "./bot.resolver";
import { ChatLinkCodeModel } from "./model/chat-link-code.model";
import { ChatLinkModel } from "./model/chat-link.model";
import { TelegramApiService } from "./telegram/telegram-api.service";
import { TelegramController } from "./telegram/telegram.controller";
import {
  TelegramBotService,
  TelegramUpdateHandler,
} from "./telegram/telegram.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatLinkModel, ChatLinkCodeModel]),
    UsersModule,
    AvailabilityModule,
  ],
  controllers: [TelegramController],
  providers: [
    BotLinkService,
    BotResolver,
    TelegramApiService,
    TelegramUpdateHandler,
    TelegramBotService,
  ],
  exports: [BotLinkService],
})
export class BotModule {}
