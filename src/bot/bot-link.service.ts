import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { randomBytesAsync } from "src/app/util/random_bytes_async";
import { ChatLinkCodeModel } from "./model/chat-link-code.model";
import { ChatLinkModel, ChatPlatform } from "./model/chat-link.model";
import {
  LINK_CODE_TTL_MINUTES,
  TELEGRAM_BOT_USERNAME,
  buildTelegramDeepLink,
  isValidTelegramUsername,
  normalizeTelegramUsername,
} from "./bot.constants";
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

  async requestTelegramLink(userId: string, username: string) {
    if (!isValidTelegramUsername(username)) {
      throw new BadRequestException("Enter a valid Telegram username (5-32 characters).");
    }

    const user = await this.usersService.findOneById(userId);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const telegramUsername = normalizeTelegramUsername(username);

    const existingForUsername = await this.chatLinkRepository.findOne({
      where: { platform: ChatPlatform.TELEGRAM, telegramUsername },
    });

    if (existingForUsername && String(existingForUsername.userId) !== String(userId)) {
      throw new BadRequestException("This Telegram username is already linked to another account.");
    }

    await this.chatLinkCodeRepository.delete({ userId });

    const code = await this.createLinkCode();
    const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MINUTES * 60_000).toISOString();

    await this.chatLinkCodeRepository.save(
      this.chatLinkCodeRepository.create({
        code,
        userId,
        expiresAt,
        telegramUsername,
      })
    );

    return {
      code,
      deepLink: buildTelegramDeepLink(code),
      botUsername: TELEGRAM_BOT_USERNAME,
      expiresAt,
      telegramUsername,
    };
  }

  async getTelegramLinkStatus(userId: string) {
    const link = await this.findByUserId(ChatPlatform.TELEGRAM, userId);

    return {
      linked: Boolean(link),
      telegramUsername: link?.telegramUsername ?? null,
      botUsername: TELEGRAM_BOT_USERNAME,
    };
  }

  async unlinkTelegram(userId: string) {
    const result = await this.chatLinkRepository.delete({
      platform: ChatPlatform.TELEGRAM,
      userId: String(userId),
    });

    await this.chatLinkCodeRepository.delete({ userId: String(userId) });

    return { affected: result.affected ?? 0 };
  }

  async linkChatFromStart(
    platform: ChatPlatform,
    externalChatId: string,
    code: string,
    telegramUsernameFromMessage?: string
  ) {
    const linkCode = await this.chatLinkCodeRepository.findOne({
      where: { code },
      relations: ["user", "user.profile"],
    });

    if (!linkCode) {
      throw new BadRequestException("Invalid or expired connect link. Request a new one in the HRM app.");
    }

    if (new Date(linkCode.expiresAt).getTime() < Date.now()) {
      await this.chatLinkCodeRepository.delete({ code });
      throw new BadRequestException("Connect link expired. Open Telegram again from the HRM app.");
    }

    const actualUsername = telegramUsernameFromMessage
      ? normalizeTelegramUsername(telegramUsernameFromMessage)
      : null;

    if (!actualUsername) {
      throw new BadRequestException(
        "Your Telegram account must have a public @username. Set one in Telegram settings and try again."
      );
    }

    if (actualUsername !== linkCode.telegramUsername) {
      throw new BadRequestException(
        `This Telegram account (@${actualUsername}) does not match the username entered in the HRM app (@${linkCode.telegramUsername}).`
      );
    }

    await this.chatLinkRepository.delete({ externalChatId });
    await this.chatLinkRepository.delete({ userId: linkCode.userId });
    await this.chatLinkRepository.delete({
      platform,
      telegramUsername: linkCode.telegramUsername,
    });

    const link = await this.chatLinkRepository.save(
      this.chatLinkRepository.create({
        platform,
        externalChatId,
        userId: linkCode.userId,
        telegramUsername: linkCode.telegramUsername,
        user: linkCode.user,
      })
    );

    await this.chatLinkCodeRepository.delete({ code });

    return link;
  }

  findAllTelegramLinks() {
    return this.chatLinkRepository.find({
      where: { platform: ChatPlatform.TELEGRAM },
      relations: ["user", "user.profile"],
    });
  }

  findByExternalChat(platform: ChatPlatform, externalChatId: string) {
    return this.chatLinkRepository.findOne({
      where: { platform, externalChatId },
      relations: ["user", "user.profile"],
    });
  }

  findByUserId(platform: ChatPlatform, userId: string) {
    return this.chatLinkRepository.findOne({
      where: { platform, userId: String(userId) },
    });
  }

  private async createLinkCode() {
    return (await randomBytesAsync(16)).toString("hex");
  }
}
