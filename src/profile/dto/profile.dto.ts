import { Type } from "class-transformer";
import { IsISO8601, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { CreateProfileInput, UpdateProfileInput } from "src/graphql";

export class CreateProfileDto implements CreateProfileInput {
  @IsString()
  first_name: string;

  @IsString()
  last_name: string;
}

export class UpdateProfileDto extends CreateProfileDto implements UpdateProfileInput {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsOptional()
  @IsISO8601()
  birth_date?: string;

  @IsOptional()
  @IsString()
  education?: string;
}
