import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import { GetUserId } from "src/app/decorators/get_user_id.decorator";
import { GetUserRole } from "src/app/decorators/get_user_role.decorator";
import { UserRole } from "src/graphql";
import { AvailabilityService } from "./availability.service";
import { SetAvailabilityDto, TeamAvailabilityFilterDto } from "./dto/availability.dto";

@Resolver()
export class AvailabilityResolver {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Query("myAvailability")
  myAvailability(@GetUserId() userId: string) {
    return this.availabilityService.getMyAvailability(userId);
  }

  @Query("teamAvailability")
  teamAvailability(
    @GetUserId() userId: string,
    @GetUserRole() role: UserRole,
    @Args("filter") filter?: TeamAvailabilityFilterDto
  ) {
    return this.availabilityService.getTeamAvailability(userId, role, filter);
  }

  @Query("availabilityHistory")
  availabilityHistory(@Args("userId") userId: string) {
    return this.availabilityService.getAvailabilityHistory(userId);
  }

  @Mutation("setAvailability")
  setAvailability(
    @GetUserId() userId: string,
    @GetUserRole() role: UserRole,
    @Args("input") input: SetAvailabilityDto
  ) {
    return this.availabilityService.setAvailability(userId, role, input);
  }
}
