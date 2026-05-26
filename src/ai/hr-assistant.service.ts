import { Injectable } from "@nestjs/common";
import { AvailabilityStatus, UserRole } from "src/graphql";
import { AvailabilityService } from "src/availability/availability.service";
import type { AiLocale, HrAssistantResult, TeamAvailabilitySnapshot } from "./ai.types";
import { LlmService } from "./llm.service";

const STATUS_ALIASES: Record<string, AvailabilityStatus> = {
  office: AvailabilityStatus.OFFICE,
  remote: AvailabilityStatus.REMOTE,
  sick_day: AvailabilityStatus.SICK_DAY,
  sickday: AvailabilityStatus.SICK_DAY,
  sick_list: AvailabilityStatus.SICK_LIST,
  sickleave: AvailabilityStatus.SICK_LIST,
  vacation: AvailabilityStatus.VACATION,
  unknown: AvailabilityStatus.UNKNOWN,
  офис: AvailabilityStatus.OFFICE,
  удаленно: AvailabilityStatus.REMOTE,
  удалённо: AvailabilityStatus.REMOTE,
  болею: AvailabilityStatus.SICK_DAY,
  больничный: AvailabilityStatus.SICK_LIST,
  больничном: AvailabilityStatus.SICK_LIST,
  отпуск: AvailabilityStatus.VACATION,
};

@Injectable()
export class HrAssistantService {
  constructor(
    private readonly availabilityService: AvailabilityService,
    private readonly llmService: LlmService
  ) {}

  async ask(
    requesterId: string,
    requesterRole: UserRole,
    question: string,
    locale: AiLocale
  ): Promise<HrAssistantResult> {
    const trimmed = question.trim();
    if (!trimmed) {
      return this.emptyQuestion(locale);
    }

    const snapshot = await this.buildSnapshot(requesterId, requesterRole);

    if (this.llmService.isConfigured()) {
      const aiAnswer = await this.answerWithLlm(trimmed, locale, snapshot);
      if (aiAnswer) {
        return { answer: aiAnswer, source: "ai" };
      }
    }

    return { answer: this.answerWithRules(trimmed, locale, snapshot), source: "rules" };
  }

  private async buildSnapshot(
    requesterId: string,
    requesterRole: UserRole
  ): Promise<TeamAvailabilitySnapshot> {
    const rows = await this.availabilityService.getTeamAvailability(
      requesterId,
      requesterRole
    );

    const counts = {
      [AvailabilityStatus.OFFICE]: 0,
      [AvailabilityStatus.REMOTE]: 0,
      [AvailabilityStatus.SICK_DAY]: 0,
      [AvailabilityStatus.SICK_LIST]: 0,
      [AvailabilityStatus.VACATION]: 0,
      [AvailabilityStatus.UNKNOWN]: 0,
    };

    const members = rows.map((row) => {
      counts[row.status] += 1;
      const firstName = row.user.profile?.first_name?.trim() ?? "";
      const lastName = row.user.profile?.last_name?.trim() ?? "";
      const fullName = `${firstName} ${lastName}`.trim();

      return {
        name: fullName || row.user.email,
        email: row.user.email,
        department: row.user.department_name ?? row.user.department?.name ?? "",
        status: row.status,
      };
    });

    return { members, counts, total: members.length };
  }

  private async answerWithLlm(
    question: string,
    locale: AiLocale,
    snapshot: TeamAvailabilitySnapshot
  ) {
    return this.llmService.completeText([
      {
        role: "system",
        content: [
          "You are an HR assistant inside an employee availability app.",
          "Answer ONLY using the provided team JSON snapshot.",
          "Do not invent employees or statuses.",
          "Be concise (2-6 sentences).",
          locale === "ru" ? "Reply in Russian." : "Reply in English.",
        ].join(" "),
      },
      {
        role: "user",
        content: `Question: ${question}\n\nTeam snapshot JSON:\n${JSON.stringify(snapshot)}`,
      },
    ]);
  }

  private answerWithRules(
    question: string,
    locale: AiLocale,
    snapshot: TeamAvailabilitySnapshot
  ) {
    const normalized = question.toLowerCase();
    const status = this.detectStatus(normalized);

    if (status) {
      const matches = snapshot.members.filter((member) => member.status === status);
      return this.formatStatusList(locale, status, matches);
    }

    if (this.isCountQuestion(normalized)) {
      return this.formatSummary(locale, snapshot);
    }

    if (this.isListQuestion(normalized)) {
      return this.formatSummary(locale, snapshot);
    }

    return locale === "ru"
      ? "Спросите, например: «Кто сегодня в офисе?», «Кто удалённо?», «Сколько человек в отпуске?»"
      : "Try asking: “Who is in the office today?”, “Who is working remotely?”, or “How many people are on vacation?”";
  }

  private detectStatus(text: string) {
    for (const [alias, status] of Object.entries(STATUS_ALIASES)) {
      if (text.includes(alias)) {
        return status;
      }
    }

    if (/office|офис/.test(text)) return AvailabilityStatus.OFFICE;
    if (/remote|удал/.test(text)) return AvailabilityStatus.REMOTE;
    if (/sick day|болею|больной день/.test(text)) return AvailabilityStatus.SICK_DAY;
    if (/sick leave|sick list|больнич/.test(text)) return AvailabilityStatus.SICK_LIST;
    if (/vacation|отпуск/.test(text)) return AvailabilityStatus.VACATION;

    return null;
  }

  private isCountQuestion(text: string) {
    return /\b(how many|count|сколько)\b/i.test(text);
  }

  private isListQuestion(text: string) {
    return /\b(who|list|show|кто|покажи|список)\b/i.test(text);
  }

  private formatStatusList(
    locale: AiLocale,
    status: AvailabilityStatus,
    members: TeamAvailabilitySnapshot["members"]
  ) {
    const label = this.statusLabel(locale, status);

    if (members.length === 0) {
      return locale === "ru"
        ? `Сейчас никто не отмечен как «${label}».`
        : `No one is currently marked as ${label}.`;
    }

    const names = members.map((member) => member.name).join(", ");
    return locale === "ru"
      ? `${label}: ${members.length} — ${names}.`
      : `${label}: ${members.length} — ${names}.`;
  }

  private formatSummary(locale: AiLocale, snapshot: TeamAvailabilitySnapshot) {
    if (snapshot.total === 0) {
      return locale === "ru"
        ? "В вашей команде пока нет данных о доступности."
        : "There is no team availability data to show yet.";
    }

    const parts = [
      AvailabilityStatus.OFFICE,
      AvailabilityStatus.REMOTE,
      AvailabilityStatus.SICK_DAY,
      AvailabilityStatus.SICK_LIST,
      AvailabilityStatus.VACATION,
      AvailabilityStatus.UNKNOWN,
    ]
      .filter((status) => snapshot.counts[status] > 0)
      .map((status) => `${this.statusLabel(locale, status)}: ${snapshot.counts[status]}`);

    return locale === "ru"
      ? `Сводка по команде (${snapshot.total}): ${parts.join("; ")}.`
      : `Team summary (${snapshot.total}): ${parts.join("; ")}.`;
  }

  private statusLabel(locale: AiLocale, status: AvailabilityStatus) {
    const labels: Record<AiLocale, Record<AvailabilityStatus, string>> = {
      en: {
        [AvailabilityStatus.OFFICE]: "In the office",
        [AvailabilityStatus.REMOTE]: "Remote",
        [AvailabilityStatus.SICK_DAY]: "Sick day",
        [AvailabilityStatus.SICK_LIST]: "Sick leave",
        [AvailabilityStatus.VACATION]: "Vacation",
        [AvailabilityStatus.UNKNOWN]: "Unknown",
      },
      ru: {
        [AvailabilityStatus.OFFICE]: "В офисе",
        [AvailabilityStatus.REMOTE]: "Удалённо",
        [AvailabilityStatus.SICK_DAY]: "Болею",
        [AvailabilityStatus.SICK_LIST]: "На больничном",
        [AvailabilityStatus.VACATION]: "В отпуске",
        [AvailabilityStatus.UNKNOWN]: "Неизвестно",
      },
    };

    return labels[locale][status];
  }

  private emptyQuestion(locale: AiLocale): HrAssistantResult {
    return {
      answer:
        locale === "ru"
          ? "Введите вопрос о доступности команды."
          : "Enter a question about team availability.",
      source: "rules",
    };
  }
}
