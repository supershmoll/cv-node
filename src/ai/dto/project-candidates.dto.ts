import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class ProjectCandidatesDto {
  @IsString()
  projectId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(16)
  @Max(80)
  minAge?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(16)
  @Max(80)
  maxAge?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  educationHint?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  positionId?: string;

  @IsOptional()
  @IsBoolean()
  requireAvailable?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(25)
  limit?: number;

  @IsOptional()
  @IsIn(["en", "ru"])
  locale?: "en" | "ru";
}
