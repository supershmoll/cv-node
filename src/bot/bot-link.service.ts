import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ChatLinkCodeModel } from "./model/chat-link-code.model";
import { ChatLinkModel, ChatPlatform } from "./model/chat-link.model";
import { LINK_CODE_TTL_MINUTES } from "./bot.constants";
import { UsersService } from "src/users/users.service";

@Injectable()
export class BotLinkService {
  constructor(
    @InjectRepository(ChatLinkModel)
    private readonly chatLinkRepository: Repository<ChatLinkModel>,
    @InjectRepository(ChatLinkCodeModel)
    private readonly chatLinkCodeRepository: Repository<ChatLinkCodeModel>,
    private readonly usersService: UsersService
  ) {}

  async generateLinkCode(userId: string) {
    const user = await this.usersService.findOneById(userId);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    await this.chatLinkCodeRepository.delete({ userId });

    const code = this.createLinkCode();
    const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MINUTES * 60_000).toISOString();

    await this.chatLinkCodeRepository.save(
      this.chatLinkCodeRepository.create({ code, userId, expiresAt })
    );

    return { code, expiresAt };
  }

  async linkChat(platform: ChatPlatform, externalChatId: string, code: string) {
    const linkCode = await this.chatLinkCodeRepository.findOne({
      where: { code },
      relations: ["user", "user.profile"],
    });

    if (!linkCode) {
      throw new BadRequestException("Invalid link code");
    }

    if (new Date(linkCode.expiresAt).getTime() < Date.now()) {
      await this.chatLinkCodeRepository.delete({ code });
      throw new BadRequestException("Link code expired. Generate a new one in the app.");
    }

    await this.chatLinkRepository.delete({ externalChatId });
    await this.chatLinkRepository.delete({ userId: linkCode.userId });

    const link = await this.chatLinkRepository.save(
      this.chatLinkRepository.create({
        platform,
        externalChatId,
        userId: linkCode.userId,
        user: linkCode.user,
      })
    );

    await this.chatLinkCodeRepository.delete({ code });

    return link;
  }

  findByExternalChat(platform: ChatPlatform, externalChatId: string) {
    return this.chatLinkRepository.findOne({
      where: { platform, externalChatId },
      relations: ["user", "user.profile"],
    });
  }

  findByUserId(platform: ChatPlatform, userId: string) {
    return this.chatLinkRepository.findOne({
      where: { platform, userId },
    });
  }

  private createLinkCode() {
    return [...Array(6)].map(() => (Math.random() * 10) | 0).join("");
  }
}
