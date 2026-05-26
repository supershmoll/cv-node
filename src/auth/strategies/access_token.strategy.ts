import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { UserRole } from "src/graphql";
import { UsersService } from "src/users/users.service";

export type JwtPayload = {
  sub: string;
  email: string;
  role: UserRole;
  sessionVersion?: number;
  jti?: string;
};

const sessionExpired = new UnauthorizedException({
  message: "Session expired. Please log in again.",
});

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.usersService.findOneById(String(payload.sub));

    if (!user) {
      throw sessionExpired;
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
