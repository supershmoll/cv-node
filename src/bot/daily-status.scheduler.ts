import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { UsersService } from "src/users/users.service";
import { BotLinkService } from "./bot-link.service";
import { DailyStatusService } from "./daily-status.service";
import {
  DEADLINE_HOUR,
  MORNING_PROMPT_HOUR,
  REMINDER_HOURS,
  STATUS_CHECK_TIMEZONE,
} from "./bot.constants";
import { TelegramApiService } from "./telegram/telegram-api.service";
import {
  buildForceLogoutText,
  buildMorningPromptText,
  buildReminderText,
  buildStatusKeyboard,
} from "./telegram/telegram-messages";

@Injectable()
export class DailyStatusScheduler {
  private readonly logger = new Logger(DailyStatusScheduler.name);

  constructor(
    private readonly botLinkService: BotLinkService,
    private readonly dailyStatusService: DailyStatusService,
    private readonly telegramApi: TelegramApiService,
    private readonly usersService: UsersService
  ) {}

  @Cron(`0 ${MORNING_PROMPT_HOUR} * * *`, { timeZone: STATUS_CHECK_TIMEZONE })
  async sendMorningPrompts() {
    await this.broadcastToUnconfirmed((locale) => buildMorningPromptText(locale), {
      createDailyCheck: true,
    });
  }

  @Cron(`0 ${REMINDER_HOURS[0]} * * *`, { timeZone: STATUS_CHECK_TIMEZONE })
  async sendTenAmReminder() {
    await this.broadcastToUnconfirmed((locale) => buildReminderText(locale, REMINDER_HOURS[0]));
  }

  @Cron(`0 ${REMINDER_HOURS[1]} * * *`, { timeZone: STATUS_CHECK_TIMEZONE })
  async sendElevenAmReminder() {
    await this.broadcastToUnconfirmed((locale) => buildReminderText(locale, REMINDER_HOURS[1]));
  }

  @Cron(`0 ${DEADLINE_HOUR} * * *`, { timeZone: STATUS_CHECK_TIMEZONE })
  async enforceNoonDeadline() {
    if (!this.telegramApi.isConfigured()) {
      return;
    }

    const links = await this.botLinkService.findAllTelegramLinks();
    const userIds = links.map((link) => String(link.userId));
    const unconfirmedUserIds = await this.dailyStatusService.getUnconfirmedForToday(userIds);

    for (const userId of unconfirmedUserIds) {
      await this.usersService.invalidateSession(userId);
      await this.dailyStatusService.markForceLoggedOut(userId);

      const link = links.find((item) => String(item.userId) === userId);
      if (link) {
        const locale = this.botLinkService.getLinkLocale(link);
        await this.telegramApi
          .sendMessage(
            link.externalChatId,
            buildForceLogoutText(locale),
            buildStatusKeyboard(locale)
          )
          .catch((error) => this.logger.error(`Failed to notify user ${userId}`, error));
      }
    }

    this.logger.log(`Force-logged out ${unconfirmedUserIds.length} users at noon deadline.`);
  }

  private async broadcastToUnconfirmed(
    buildMessage: (locale: ReturnType<BotLinkService["getLinkLocale"]>) => string,
    options: { createDailyCheck?: boolean } = {}
  ) {
    if (!this.telegramApi.isConfigured()) {
      return;
    }

    const links = await this.botLinkService.findAllTelegramLinks();

    for (const link of links) {
      const userId = String(link.userId);
      const locale = this.botLinkService.getLinkLocale(link);

      if (options.createDailyCheck) {
        await this.dailyStatusService.ensureDailyCheck(userId);
      }

      const todayCheck = await this.dailyStatusService.getTodayCheck(userId);
      if (todayCheck?.confirmedAt) {
        continue;
      }

      await this.dailyStatusService.incrementReminder(userId);

      await this.telegramApi
        .sendMessage(link.externalChatId, buildMessage(locale), buildStatusKeyboard(locale))
        .catch((error) => this.logger.error(`Failed to send prompt to user ${userId}`, error));
    }
  }
}
