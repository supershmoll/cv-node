import { Mutation, Resolver } from "@nestjs/graphql";
import { GetUserId } from "src/app/decorators/get_user_id.decorator";
import { BotLinkService } from "./bot-link.service";

@Resolver()
export class BotResolver {
  constructor(private readonly botLinkService: BotLinkService) {}

  @Mutation("generateBotLinkCode")
  generateBotLinkCode(@GetUserId() userId: string) {
    return this.botLinkService.generateLinkCode(userId);
  }
}
