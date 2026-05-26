import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersModule } from "src/users/users.module";
import { AvailabilityService } from "./availability.service";
import { AvailabilityResolver } from "./availability.resolver";
import { UserAvailabilityModel } from "./model/user-availability.model";
import { AvailabilityEventModel } from "./model/availability-event.model";

@Module({
  imports: [
    TypeOrmModule.forFeature([UserAvailabilityModel, AvailabilityEventModel]),
    UsersModule,
  ],
  providers: [AvailabilityResolver, AvailabilityService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
