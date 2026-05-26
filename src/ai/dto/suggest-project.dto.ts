import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class SuggestProjectDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  brief: string;

  @IsOptional()
  @IsIn(["en", "ru"])
  locale?: "en" | "ru";
}
