import { Args, Query, Resolver } from "@nestjs/graphql";
import { Roles } from "src/app/guards/roles.decorator";
import { GetUserId } from "src/app/decorators/get_user_id.decorator";
import { GetUserRole } from "src/app/decorators/get_user_role.decorator";
import { HrAssistantSource, ProjectCandidateSource, ProjectSuggestionSource, UserRole } from "src/graphql";
import { HrAssistantService } from "./hr-assistant.service";
import { ProjectSuggestionService } from "./project-suggestion.service";
import { ProjectCandidateMatcherService } from "./project-candidate-matcher.service";
import { AskHrAssistantDto } from "./dto/ask-hr-assistant.dto";
import { SuggestProjectDto } from "./dto/suggest-project.dto";
import { ProjectCandidatesDto } from "./dto/project-candidates.dto";
import type { AiLocale } from "./ai.types";
@Resolver()
export class AiResolver {
  constructor(
    private readonly hrAssistantService: HrAssistantService,
    private readonly projectSuggestionService: ProjectSuggestionService,
    private readonly projectCandidateMatcherService: ProjectCandidateMatcherService
  ) {}

  @Query("askHrAssistant")
  async askHrAssistant(
    @GetUserId() userId: string,
    @GetUserRole() role: UserRole,
    @Args("input") input: AskHrAssistantDto
  ) {
    const locale = this.normalizeLocale(input.locale);
    const result = await this.hrAssistantService.ask(
      userId,
      role,
      input.question,
      locale
    );

    return {
      answer: result.answer,
      source: result.source === "ai" ? HrAssistantSource.AI : HrAssistantSource.RULES,
    };
  }

  @Roles(UserRole.Admin)
  @Query("suggestProject")
  async suggestProject(@Args("input") input: SuggestProjectDto) {
    const locale = this.normalizeLocale(input.locale);
    const result = await this.projectSuggestionService.suggest(input.brief, locale);

    return {
      name: result.name,
      domain: result.domain,
      description: result.description,
      environment: result.environment,
      source:
        result.source === "ai" ? ProjectSuggestionSource.AI : ProjectSuggestionSource.RULES,
    };
  }

  @Roles(UserRole.Admin)
  @Query("projectCandidates")
  async projectCandidates(
    @GetUserRole() role: UserRole,
    @Args("input") input: ProjectCandidatesDto
  ) {
    const results = await this.projectCandidateMatcherService.findCandidates(role, {
      projectId: input.projectId,
      minAge: input.minAge,
      maxAge: input.maxAge,
      educationHint: input.educationHint,
      departmentId: input.departmentId,
      positionId: input.positionId,
      requireAvailable: input.requireAvailable,
      limit: input.limit,
      locale: this.normalizeLocale(input.locale),
    });

    return results.map((candidate) => ({
      ...candidate,
      source:
        candidate.source === "ai"
          ? ProjectCandidateSource.AI
          : ProjectCandidateSource.RULES,
    }));
  }

  private normalizeLocale(locale?: string): AiLocale {
    return locale === "ru" ? "ru" : "en";
  }
}
