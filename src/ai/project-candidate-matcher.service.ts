import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import {
  AvailabilityStatus,
  Mastery,
  UserRole,
} from "src/graphql";
import { AvailabilityService } from "src/availability/availability.service";
import { ProjectsService } from "src/projects/projects.service";
import { UsersService } from "src/users/users.service";
import { UserAvailabilityModel } from "src/availability/model/user-availability.model";
import type { AiLocale } from "./ai.types";
import { LlmService } from "./llm.service";

export type ProjectCandidateSource = "ai" | "rules";

export type ProjectCandidatesFilters = {
  projectId: string;
  minAge?: number;
  maxAge?: number;
  educationHint?: string;
  departmentId?: string;
  positionId?: string;
  requireAvailable?: boolean;
  limit?: number;
  locale?: AiLocale;
};

export type ProjectCandidateResult = {
  userId: string;
  fullName: string;
  email: string;
  department: string;
  position: string;
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  availabilityStatus: AvailabilityStatus;
  age: number | null;
  education: string;
  summary: string;
  source: ProjectCandidateSource;
};

const MASTERY_WEIGHT: Record<Mastery, number> = {
  [Mastery.Novice]: 0.25,
  [Mastery.Advanced]: 0.45,
  [Mastery.Competent]: 0.6,
  [Mastery.Proficient]: 0.8,
  [Mastery.Expert]: 1,
};

const AVAILABLE_STATUSES = new Set<AvailabilityStatus>([
  AvailabilityStatus.OFFICE,
  AvailabilityStatus.REMOTE,
  AvailabilityStatus.UNKNOWN,
]);

@Injectable()
export class ProjectCandidateMatcherService {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly usersService: UsersService,
    private readonly availabilityService: AvailabilityService,
    private readonly llmService: LlmService,
    @InjectRepository(UserAvailabilityModel)
    private readonly availabilityRepository: Repository<UserAvailabilityModel>
  ) {}

  async findCandidates(
    requesterRole: UserRole,
    filters: ProjectCandidatesFilters
  ): Promise<ProjectCandidateResult[]> {
    if (requesterRole !== UserRole.Admin) {
      return [];
    }

    const project = await this.projectsService.findOneById(filters.projectId);
    if (!project) {
      throw new NotFoundException("Project not found");
    }

    const requiredSkills = project.environment.map((skill) => skill.trim()).filter(Boolean);
    const users = await this.usersService.findAll();
    const availabilityMap = await this.loadAvailabilityMap(users.map((user) => String(user.id)));
    const locale = filters.locale ?? "en";
    const limit = Math.min(Math.max(filters.limit ?? 10, 1), 25);

    const scored = users
      .map((user) => {
        const userId = String(user.id);
        const availability =
          availabilityMap.get(userId)?.status ?? AvailabilityStatus.UNKNOWN;
        const education = this.resolveEducation(user);
        const age = this.resolveAge(user.profile?.birth_date);

        if (filters.requireAvailable && !AVAILABLE_STATUSES.has(availability)) {
          return null;
        }

        if (filters.departmentId && String(user.department?.id ?? "") !== filters.departmentId) {
          return null;
        }

        if (filters.positionId && String(user.position?.id ?? "") !== filters.positionId) {
          return null;
        }

        if (filters.minAge != null && age != null && age < filters.minAge) {
          return null;
        }

        if (filters.maxAge != null && age != null && age > filters.maxAge) {
          return null;
        }

        const skillMap = this.collectSkillMap(user);
        const { matchedSkills, missingSkills, masteryScore } = this.scoreSkills(
          requiredSkills,
          skillMap
        );
        const skillCoverage =
          requiredSkills.length === 0 ? 1 : matchedSkills.length / requiredSkills.length;
        const availabilityScore = this.scoreAvailability(availability);
        const educationScore = this.scoreEducation(education, filters.educationHint);
        const domainScore = this.scoreDomainExperience(user, project.domain);
        const orgScore = this.scoreOrgFit(user, filters.departmentId, filters.positionId);

        let matchScore = Math.round(
          skillCoverage * 50 +
            masteryScore * 15 +
            availabilityScore * 15 +
            educationScore * 10 +
            domainScore * 5 +
            orgScore * 5
        );

        if (filters.educationHint && educationScore === 0) {
          matchScore = Math.max(0, matchScore - 15);
        }

        if (
          (filters.minAge != null || filters.maxAge != null) &&
          age == null
        ) {
          matchScore = Math.max(0, matchScore - 5);
        }

        matchScore = Math.min(100, Math.max(0, matchScore));

        const firstName = user.profile?.first_name?.trim() ?? "";
        const lastName = user.profile?.last_name?.trim() ?? "";
        const fullName = `${firstName} ${lastName}`.trim() || user.email;

        return {
          userId,
          fullName,
          email: user.email,
          department: user.department_name ?? user.department?.name ?? "",
          position: user.position_name ?? user.position?.name ?? "",
          matchScore,
          matchedSkills,
          missingSkills,
          availabilityStatus: availability,
          age,
          education,
          summary: "",
          source: "rules" as const,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);

    for (const candidate of scored) {
      candidate.summary = this.buildRuleSummary(candidate, project.name, locale);
    }

    if (this.llmService.isConfigured() && scored.length > 0) {
      await this.enrichSummariesWithLlm(scored, project.name, locale);
    }

    return scored;
  }

  private async loadAvailabilityMap(userIds: string[]) {
    if (userIds.length === 0) {
      return new Map<string, UserAvailabilityModel>();
    }

    const rows = await this.availabilityRepository.find({
      where: { userId: In(userIds) },
    });

    return new Map(rows.map((row) => [String(row.userId), row]));
  }

  private collectSkillMap(user: Awaited<ReturnType<UsersService["findAll"]>>[number]) {
    const map = new Map<string, Mastery>();

    for (const skill of user.profile?.skills ?? []) {
      if (skill.name) {
        map.set(skill.name.toLowerCase(), skill.mastery);
      }
    }

    for (const cv of user.cvs ?? []) {
      for (const skill of cv.skills ?? []) {
        if (!skill.name) {
          continue;
        }
        const key = skill.name.toLowerCase();
        const existing = map.get(key);
        if (!existing || MASTERY_WEIGHT[skill.mastery] > MASTERY_WEIGHT[existing]) {
          map.set(key, skill.mastery);
        }
      }
    }

    return map;
  }

  private scoreSkills(requiredSkills: string[], skillMap: Map<string, Mastery>) {
    const matchedSkills: string[] = [];
    const missingSkills: string[] = [];
    let masteryTotal = 0;

    for (const required of requiredSkills) {
      const mastery = skillMap.get(required.toLowerCase());
      if (mastery) {
        matchedSkills.push(required);
        masteryTotal += MASTERY_WEIGHT[mastery];
      } else {
        missingSkills.push(required);
      }
    }

    const masteryScore =
      matchedSkills.length === 0 ? 0 : masteryTotal / matchedSkills.length;

    return { matchedSkills, missingSkills, masteryScore };
  }

  private scoreAvailability(status: AvailabilityStatus) {
    if (status === AvailabilityStatus.OFFICE || status === AvailabilityStatus.REMOTE) {
      return 1;
    }
    if (status === AvailabilityStatus.UNKNOWN) {
      return 0.5;
    }
    return 0;
  }

  private scoreEducation(education: string, hint?: string) {
    if (!hint?.trim()) {
      return 1;
    }

    const normalizedEducation = education.toLowerCase();
    const tokens = hint
      .toLowerCase()
      .split(/[^a-zA-Z\u0400-\u04FF0-9]+/)
      .filter((token) => token.length > 2);

    if (tokens.length === 0) {
      return 1;
    }

    const hits = tokens.filter((token) => normalizedEducation.includes(token)).length;
    return hits / tokens.length;
  }

  private scoreDomainExperience(
    user: Awaited<ReturnType<UsersService["findAll"]>>[number],
    domain: string
  ) {
    const normalizedDomain = domain.trim().toLowerCase();
    if (!normalizedDomain) {
      return 0;
    }

    for (const cv of user.cvs ?? []) {
      for (const cvProject of cv.projects ?? []) {
        const projectDomain = cvProject.project?.domain?.toLowerCase() ?? "";
        if (projectDomain && projectDomain === normalizedDomain) {
          return 1;
        }
      }
    }

    return 0;
  }

  private scoreOrgFit(
    user: Awaited<ReturnType<UsersService["findAll"]>>[number],
    departmentId?: string,
    positionId?: string
  ) {
    if (!departmentId && !positionId) {
      return 1;
    }

    let score = 0;
    let parts = 0;

    if (departmentId) {
      parts += 1;
      if (String(user.department?.id ?? "") === departmentId) {
        score += 1;
      }
    }

    if (positionId) {
      parts += 1;
      if (String(user.position?.id ?? "") === positionId) {
        score += 1;
      }
    }

    return parts === 0 ? 1 : score / parts;
  }

  private resolveEducation(user: Awaited<ReturnType<UsersService["findAll"]>>[number]) {
    const profileEducation = user.profile?.education?.trim();
    if (profileEducation) {
      return profileEducation;
    }

    const cvEducations = (user.cvs ?? [])
      .map((cv) => cv.education?.trim())
      .filter(Boolean) as string[];

    return cvEducations[0] ?? "";
  }

  private resolveAge(birthDate?: string | null) {
    if (!birthDate) {
      return null;
    }

    const date = new Date(birthDate);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const monthDiff = today.getMonth() - date.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
      age -= 1;
    }

    return age >= 0 ? age : null;
  }

  private buildRuleSummary(
    candidate: ProjectCandidateResult,
    projectName: string,
    locale: AiLocale
  ) {
    const skillsPart =
      candidate.matchedSkills.length > 0
        ? candidate.matchedSkills.join(", ")
        : locale === "ru"
          ? "нет совпадений по стеку"
          : "no stack overlap";

    const gapsPart =
      candidate.missingSkills.length > 0
        ? locale === "ru"
          ? `Не хватает: ${candidate.missingSkills.join(", ")}.`
          : `Missing: ${candidate.missingSkills.join(", ")}.`
        : "";

    const educationPart = candidate.education
      ? locale === "ru"
        ? `Образование: ${candidate.education}.`
        : `Education: ${candidate.education}.`
      : "";

    const agePart =
      candidate.age != null
        ? locale === "ru"
          ? `Возраст: ${candidate.age}.`
          : `Age: ${candidate.age}.`
        : "";

    if (locale === "ru") {
      return `${candidate.fullName} — ${candidate.matchScore}% для «${projectName}». Стек: ${skillsPart}. ${gapsPart} ${educationPart} ${agePart}`.trim();
    }

    return `${candidate.fullName} — ${candidate.matchScore}% fit for "${projectName}". Stack: ${skillsPart}. ${gapsPart} ${educationPart} ${agePart}`.trim();
  }

  private async enrichSummariesWithLlm(
    candidates: ProjectCandidateResult[],
    projectName: string,
    locale: AiLocale
  ) {
    const topCandidates = candidates.slice(0, 5);
    const response = await this.llmService.completeJson<
      Record<string, string>
    >([
      {
        role: "system",
        content: [
          "You write one short staffing recommendation sentence per candidate.",
          "Use only provided JSON facts.",
          locale === "ru" ? "Reply in Russian." : "Reply in English.",
          'Return JSON: {"summaries":{"userId":"sentence", ...}}',
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          projectName,
          candidates: topCandidates.map((candidate) => ({
            userId: candidate.userId,
            fullName: candidate.fullName,
            matchScore: candidate.matchScore,
            matchedSkills: candidate.matchedSkills,
            missingSkills: candidate.missingSkills,
            availabilityStatus: candidate.availabilityStatus,
            age: candidate.age,
            education: candidate.education,
          })),
        }),
      },
    ]);

    if (!response?.summaries) {
      return;
    }

    for (const candidate of topCandidates) {
      const summary = response.summaries[candidate.userId];
      if (summary) {
        candidate.summary = summary;
        candidate.source = "ai";
      }
    }
  }
}
