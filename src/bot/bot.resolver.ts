import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import { GetUserId } from "src/app/decorators/get_user_id.decorator";
import { BotLinkService } from "./bot-link.service";
import { LinkTelegramDto } from "./dto/link-telegram.dto";

@Resolver()
export class BotResolver {
  constructor(private readonly botLinkService: BotLinkService) {}

  @Query("telegramLinkStatus")
  telegramLinkStatus(@GetUserId() userId: string) {
    return this.botLinkService.getTelegramLinkStatus(userId);
  }

  @Mutation("linkTelegramAccount")
  linkTelegramAccount(@GetUserId() userId: string, @Args("input") input: LinkTelegramDto) {
    return this.botLinkService.requestTelegramLink(userId, input.username);
  }

  @Mutation("unlinkTelegramAccount")
  unlinkTelegramAccount(@GetUserId() userId: string) {
    return this.botLinkService.unlinkTelegram(userId);
  }
}
