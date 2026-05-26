import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AvailabilityModule } from "src/availability/availability.module";
import { AiModule } from "src/ai/ai.module";
import { UsersModule } from "src/users/users.module";
import { BotLinkService } from "./bot-link.service";
import { BotResolver } from "./bot.resolver";
import { DailyStatusScheduler } from "./daily-status.scheduler";
import { DailyStatusService } from "./daily-status.service";
import { ChatLinkCodeModel } from "./model/chat-link-code.model";
import { ChatLinkModel } from "./model/chat-link.model";
import { DailyStatusCheckModel } from "./model/daily-status-check.model";
import { TelegramApiService } from "./telegram/telegram-api.service";
import { TelegramController } from "./telegram/telegram.controller";
import {
  TelegramBotService,
  TelegramUpdateHandler,
} from "./telegram/telegram.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatLinkModel, ChatLinkCodeModel, DailyStatusCheckModel]),
    UsersModule,
    AvailabilityModule,
    AiModule,
  ],
  controllers: [TelegramController],
  providers: [
    BotLinkService,
    BotResolver,
    DailyStatusService,
    DailyStatusScheduler,
    TelegramApiService,
    TelegramUpdateHandler,
    TelegramBotService,
  ],
  exports: [BotLinkService, DailyStatusService],
})
export class BotModule {}
