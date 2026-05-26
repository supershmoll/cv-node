import { ExtractJwt, Strategy } from "passport-jwt";
import { PassportStrategy } from "@nestjs/passport";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { UsersService } from "src/users/users.service";
import { JwtPayload } from "./access_token.strategy";

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, "jwt-refresh") {
  constructor(private readonly usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET_2,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.usersService.findOneById(String(payload.sub));

    if (!user) {
      throw new UnauthorizedException({ message: "Session expired. Please log in again." });
    }

    const tokenVersion = payload.sessionVersion ?? 0;
    const userVersion = user.sessionVersion ?? 0;

    if (tokenVersion !== userVersion) {
      throw new UnauthorizedException({
        message:
          "Your session was ended because today's work status was not confirmed in Telegram. Please log in again.",
      });
    }

    return payload;
  }
}
