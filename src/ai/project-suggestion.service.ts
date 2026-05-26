import { Injectable } from "@nestjs/common";
import { ProjectsService } from "src/projects/projects.service";
import { SkillsService } from "src/skills/skills.service";
import type { AiLocale } from "./ai.types";
import { LlmService } from "./llm.service";

export type ProjectSuggestionSource = "ai" | "rules";

export type ProjectSuggestionResult = {
  name: string;
  domain: string;
  description: string;
  environment: string[];
  source: ProjectSuggestionSource;
};

const NAME_MAX = 120;
const DOMAIN_MAX = 120;
const DESCRIPTION_MAX = 2000;

const DOMAIN_KEYWORDS: Array<{ pattern: RegExp; domain: string }> = [
  { pattern: /e-?commerce|online shop|store|retail|магазин|ecommerce/i, domain: "E-commerce" },
  { pattern: /fintech|bank|finance|payment|банк|фин/i, domain: "FinTech" },
  { pattern: /health|medical|clinic|мед|здоров/i, domain: "Healthcare" },
  { pattern: /hr|human resource|employee|персонал|hrm/i, domain: "HR" },
  { pattern: /mobile|ios|android|мобил/i, domain: "Mobile" },
  { pattern: /education|learning|course|обучен/i, domain: "EdTech" },
];

const STACK_HINTS: Array<{ pattern: RegExp; skills: string[] }> = [
  {
    pattern: /react|frontend|spa|ui|интерфейс/i,
    skills: ["React", "TypeScript", "HTML", "CSS"],
  },
  {
    pattern: /node|backend|api|server|бэкенд|сервер/i,
    skills: ["Node.js", "TypeScript", "GraphQL", "PostgreSQL"],
  },
  {
    pattern: /mobile|ios|android|flutter|мобил/i,
    skills: ["React", "TypeScript", "JavaScript"],
  },
  {
    pattern: /cloud|aws|docker|devops|kubernetes/i,
    skills: ["Docker", "AWS", "CI/CD"],
  },
  {
    pattern: /java|spring|enterprise/i,
    skills: ["Java", "Spring", "PostgreSQL"],
  },
];

@Injectable()
export class ProjectSuggestionService {
  constructor(
    private readonly llmService: LlmService,
    private readonly skillsService: SkillsService,
    private readonly projectsService: ProjectsService
  ) {}

  async suggest(brief: string, locale: AiLocale): Promise<ProjectSuggestionResult> {
    const trimmed = brief.trim();
    const catalogSkills = (await this.skillsService.findAll())
      .map((skill) => skill.name?.trim())
      .filter(Boolean) as string[];
    const existingNames = (await this.projectsService.findAll()).map((project) => project.name);

    if (this.llmService.isConfigured()) {
      const aiSuggestion = await this.suggestWithLlm(
        trimmed,
        locale,
        catalogSkills,
        existingNames
      );
      if (aiSuggestion) {
        return aiSuggestion;
      }
    }

    return this.suggestWithRules(trimmed, locale, catalogSkills, existingNames);
  }

  private async suggestWithLlm(
    brief: string,
    locale: AiLocale,
    catalogSkills: string[],
    existingNames: string[]
  ): Promise<ProjectSuggestionResult | null> {
    const result = await this.llmService.completeJson<{
      name?: string;
      domain?: string;
      description?: string;
      environment?: string[];
    }>([
      {
        role: "system",
        content: [
          "You suggest fields for a new software project catalog entry in an HRM system.",
          "Return JSON only with keys: name, domain, description, environment.",
          "environment must be an array of skill names chosen ONLY from the provided catalog list.",
          "Pick 3-8 relevant technologies. Do not invent skill names.",
          "Keep name <= 120 chars, domain <= 120 chars, description <= 500 chars.",
          locale === "ru" ? "Write description in Russian." : "Write description in English.",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          brief,
          catalogSkills,
          existingProjectNames: existingNames.slice(0, 30),
        }),
      },
    ]);

    if (!result?.name || !result.domain || !result.description) {
      return null;
    }

    const environment = this.normalizeEnvironment(result.environment ?? [], catalogSkills);
    if (environment.length === 0) {
      return null;
    }

    return {
      name: this.clip(result.name, NAME_MAX),
      domain: this.clip(result.domain, DOMAIN_MAX),
      description: this.clip(result.description, DESCRIPTION_MAX),
      environment,
      source: "ai",
    };
  }

  private suggestWithRules(
    brief: string,
    locale: AiLocale,
    catalogSkills: string[],
    existingNames: string[]
  ): ProjectSuggestionResult {
    const domain = this.inferDomain(brief);
    const name = this.buildName(brief, domain, existingNames);
    const preferredSkills = this.inferPreferredSkills(brief);
    const environment = this.normalizeEnvironment(preferredSkills, catalogSkills);
    const description = this.buildDescription(name, domain, environment, locale);

    return {
      name,
      domain,
      description,
      environment,
      source: "rules",
    };
  }

  private inferDomain(brief: string) {
    for (const entry of DOMAIN_KEYWORDS) {
      if (entry.pattern.test(brief)) {
        return entry.domain;
      }
    }
    return "Enterprise";
  }

  private buildName(brief: string, domain: string, existingNames: string[]) {
    const words = brief
      .replace(/[^a-zA-Z\u0400-\u04FF0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2)
      .slice(0, 4);

    const base =
      words.length > 0
        ? words.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ")
        : `${domain} Platform`;

    let candidate = base.includes("Project") ? base : `${base} Project`;
    let suffix = 1;

    while (existingNames.some((name) => name.toLowerCase() === candidate.toLowerCase())) {
      suffix += 1;
      candidate = `${base} Project ${suffix}`;
    }

    return this.clip(candidate, NAME_MAX);
  }

  private inferPreferredSkills(brief: string) {
    const collected: string[] = [];

    for (const hint of STACK_HINTS) {
      if (hint.pattern.test(brief)) {
        collected.push(...hint.skills);
      }
    }

    if (collected.length === 0) {
      collected.push("TypeScript", "React", "Node.js", "GraphQL", "PostgreSQL");
    }

    return collected;
  }

  private normalizeEnvironment(requested: string[], catalogSkills: string[]) {
    const catalogLower = new Map(
      catalogSkills.map((skill) => [skill.toLowerCase(), skill] as const)
    );
    const picked: string[] = [];

    for (const item of requested) {
      const normalized = item.trim();
      if (!normalized) {
        continue;
      }

      const exact = catalogLower.get(normalized.toLowerCase());
      if (exact && !picked.includes(exact)) {
        picked.push(exact);
        continue;
      }

      const fuzzy = catalogSkills.find((skill) =>
        skill.toLowerCase().includes(normalized.toLowerCase())
      );
      if (fuzzy && !picked.includes(fuzzy)) {
        picked.push(fuzzy);
      }
    }

    if (picked.length === 0) {
      for (const fallback of ["TypeScript", "React", "JavaScript", "Node.js", "HTML", "CSS"]) {
        const match = catalogLower.get(fallback.toLowerCase());
        if (match && !picked.includes(match)) {
          picked.push(match);
        }
        if (picked.length >= 4) {
          break;
        }
      }
    }

    return picked.slice(0, 8);
  }

  private buildDescription(
    name: string,
    domain: string,
    environment: string[],
    locale: AiLocale
  ) {
    const stack = environment.join(", ");
    if (locale === "ru") {
      return this.clip(
        `${name} — ${domain.toLowerCase()}-проект. Основной стек: ${stack}. Команда разрабатывает масштабируемое решение с упором на качество кода, тестирование и поддерживаемую архитектуру.`,
        DESCRIPTION_MAX
      );
    }

    return this.clip(
      `${name} is a ${domain.toLowerCase()} project. Core stack: ${stack}. The team delivers a scalable solution with maintainable architecture, testing, and clear delivery practices.`,
      DESCRIPTION_MAX
    );
  }

  private clip(value: string, max: number) {
    return value.trim().slice(0, max);
  }
}
