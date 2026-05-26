import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class AskHrAssistantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  question: string;

  @IsOptional()
  @IsIn(["en", "ru"])
  locale?: "en" | "ru";
}
