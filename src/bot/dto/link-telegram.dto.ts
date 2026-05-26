import { IsNotEmpty, IsString } from "class-validator";
import { LinkTelegramInput } from "src/graphql";

export class LinkTelegramDto implements LinkTelegramInput {
  @IsString()
  @IsNotEmpty()
  username: string;
}
