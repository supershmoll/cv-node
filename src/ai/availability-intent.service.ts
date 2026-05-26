import { Injectable } from "@nestjs/common";
import { AvailabilityStatus } from "src/graphql";
import type { AiLocale, ParsedAvailabilityIntent } from "./ai.types";
import { LlmService } from "./llm.service";

const RULES: Array<{ status: AvailabilityStatus; patterns: RegExp[] }> = [
  {
    status: AvailabilityStatus.OFFICE,
    patterns: [
      /\b(in the )?office\b/i,
      /\b(at the office|going to office|work from office)\b/i,
      /(^|\s)(в офисе|офис|на работе в офисе)(\s|$|[.,!])/i,
    ],
  },
  {
    status: AvailabilityStatus.REMOTE,
    patterns: [
      /\b(remote(ly)?|wfh|work from home|from home)\b/i,
      /(^|\s)(удалённо|удаленно|из дома|дома|на удал[её]нке)(\s|$|[.,!])/i,
    ],
  },
  {
    status: AvailabilityStatus.SICK_LIST,
    patterns: [
      /\b(sick leave|on sick leave|medical leave|sick list)\b/i,
      /(^|\s)(на больничном|больничный лист|оформил больничный|больничный)(\s|$|[.,!])/i,
    ],
  },
  {
    status: AvailabilityStatus.SICK_DAY,
    patterns: [
      /\b(sick day|i am sick|i'm sick|feeling sick|not feeling well)\b/i,
      /(^|\s)(болею|заболел(а)?|плохо себя чувствую|больной день)(\s|$|[.,!])/i,
    ],
  },
  {
    status: AvailabilityStatus.VACATION,
    patterns: [
      /\b(on vacation|vacation|annual leave|pto|day off)\b/i,
      /(^|\s)(в отпуске|отпуск|в отпуск)(\s|$|[.,!])/i,
    ],
  },
];

@Injectable()
export class AvailabilityIntentService {
  constructor(private readonly llmService: LlmService) {}

  async parse(text: string, locale: AiLocale): Promise<ParsedAvailabilityIntent> {
    const normalized = text.trim();
    if (!normalized || normalized.startsWith("/")) {
      return { status: null, confidence: "low", source: "none" };
    }

    const ruleMatch = this.matchRules(normalized);
    if (ruleMatch) {
      return { status: ruleMatch, confidence: "high", source: "rule" };
    }

    const llmMatch = await this.matchWithLlm(normalized, locale);
    if (llmMatch) {
      return { status: llmMatch, confidence: "high", source: "llm" };
    }

    return { status: null, confidence: "low", source: "none" };
  }

  private matchRules(text: string) {
    for (const rule of RULES) {
      if (rule.patterns.some((pattern) => pattern.test(text))) {
        return rule.status;
      }
    }
    return null;
  }

  private async matchWithLlm(text: string, locale: AiLocale) {
    const result = await this.llmService.completeJson<{ status: string | null }>([
      {
        role: "system",
        content: [
          "You extract employee work availability status from a short chat message.",
          "Return JSON only: {\"status\": \"OFFICE\"|\"REMOTE\"|\"SICK_DAY\"|\"SICK_LIST\"|\"VACATION\"|null}.",
          "Map natural language in English or Russian to one status.",
          "SICK_DAY = one sick day without formal medical leave.",
          "SICK_LIST = official sick leave / medical certificate.",
          "If the message is unrelated or ambiguous, return null.",
        ].join(" "),
      },
      {
        role: "user",
        content: `Locale hint: ${locale}. Message: ${text}`,
      },
    ]);

    if (!result?.status) {
      return null;
    }

    return Object.values(AvailabilityStatus).includes(result.status as AvailabilityStatus)
      ? (result.status as AvailabilityStatus)
      : null;
  }
}
