import { IsEnum, IsOptional, IsString } from "class-validator";
import {
  AvailabilityStatus,
  AvailabilityUpdatedBy,
  SetAvailabilityInput,
  TeamAvailabilityFilter,
} from "src/graphql";

export class SetAvailabilityDto implements SetAvailabilityInput {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsEnum(AvailabilityStatus)
  status: AvailabilityStatus;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  effectiveFrom?: string;

  @IsOptional()
  @IsString()
  effectiveTo?: string;

  @IsOptional()
  @IsEnum(AvailabilityUpdatedBy)
  updatedBy?: AvailabilityUpdatedBy;
}

export class TeamAvailabilityFilterDto implements TeamAvailabilityFilter {
  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsEnum(AvailabilityStatus)
  status?: AvailabilityStatus;
}
