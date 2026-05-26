import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AvailabilityModule } from "src/availability/availability.module";
import { UserAvailabilityModel } from "src/availability/model/user-availability.model";
import { ProjectsModule } from "src/projects/projects.module";
import { SkillsModule } from "src/skills/skills.module";
import { UsersModule } from "src/users/users.module";
import { AvailabilityIntentService } from "./availability-intent.service";
import { HrAssistantService } from "./hr-assistant.service";
import { ProjectSuggestionService } from "./project-suggestion.service";
import { ProjectCandidateMatcherService } from "./project-candidate-matcher.service";
import { LlmService } from "./llm.service";
import { AiResolver } from "./ai.resolver";

@Module({
  imports: [
    TypeOrmModule.forFeature([UserAvailabilityModel]),
    AvailabilityModule,
    ProjectsModule,
    SkillsModule,
    UsersModule,
  ],
  providers: [
    LlmService,
    AvailabilityIntentService,
    HrAssistantService,
    ProjectSuggestionService,
    ProjectCandidateMatcherService,
    AiResolver,
  ],
  exports: [
    AvailabilityIntentService,
    HrAssistantService,
    ProjectSuggestionService,
    ProjectCandidateMatcherService,
    LlmService,
  ],
})
export class AiModule {}