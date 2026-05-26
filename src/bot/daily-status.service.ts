import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { AvailabilityStatus } from "src/graphql";
import { DailyStatusCheckModel } from "./model/daily-status-check.model";
import { STATUS_CHECK_TIMEZONE } from "./bot.constants";

@Injectable()
export class DailyStatusService {
  constructor(
    @InjectRepository(DailyStatusCheckModel)
    private readonly dailyStatusRepository: Repository<DailyStatusCheckModel>
  ) {}

  getTodayDateString(date = new Date()) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: STATUS_CHECK_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }

  async ensureDailyCheck(userId: string, checkDate = this.getTodayDateString()) {
    const normalizedUserId = String(userId);
    const existing = await this.dailyStatusRepository.findOne({
      where: { userId: normalizedUserId, checkDate },
    });

    if (existing) {
      return existing;
    }

    try {
      return await this.dailyStatusRepository.save(
        this.dailyStatusRepository.create({
          userId: normalizedUserId,
          checkDate,
        })
      );
    } catch {
      return this.dailyStatusRepository.findOne({
        where: { userId: normalizedUserId, checkDate },
      });
    }
  }

  async confirmToday(userId: string, status: AvailabilityStatus) {
    const checkDate = this.getTodayDateString();
    const record = await this.ensureDailyCheck(userId, checkDate);

    if (!record) {
      return null;
    }

    record.confirmedAt = new Date().toISOString();
    record.confirmedStatus = status;

    return this.dailyStatusRepository.save(record);
  }

  isConfirmed(record: DailyStatusCheckModel) {
    return Boolean(record.confirmedAt);
  }

  async getTodayCheck(userId: string) {
    return this.dailyStatusRepository.findOne({
      where: { userId: String(userId), checkDate: this.getTodayDateString() },
    });
  }

  async getUnconfirmedForToday(userIds: string[]) {
    if (!userIds.length) {
      return [];
    }

    const checkDate = this.getTodayDateString();
    const records = await this.dailyStatusRepository.find({
      where: { userId: In(userIds.map(String)), checkDate },
    });
    const recordByUserId = new Map(records.map((record) => [String(record.userId), record]));

    return userIds.filter((userId) => {
      const record = recordByUserId.get(String(userId));
      return !record || !record.confirmedAt;
    });
  }

  async incrementReminder(userId: string) {
    const record = await this.ensureDailyCheck(userId);
    if (!record || record.confirmedAt) {
      return record;
    }

    record.remindersSent += 1;
    return this.dailyStatusRepository.save(record);
  }

  async markForceLoggedOut(userId: string) {
    const record = await this.ensureDailyCheck(userId);
    if (!record) {
      return null;
    }

    record.forceLoggedOut = true;
    return this.dailyStatusRepository.save(record);
  }
}
