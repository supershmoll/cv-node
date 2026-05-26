import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  AvailabilityStatus,
  AvailabilityUpdatedBy,
  SetAvailabilityInput,
  TeamAvailabilityFilter,
  UserRole,
} from "src/graphql";
import { UserAvailabilityModel } from "./model/user-availability.model";
import { AvailabilityEventModel } from "./model/availability-event.model";
import { UsersService } from "src/users/users.service";

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(UserAvailabilityModel)
    private readonly availabilityRepository: Repository<UserAvailabilityModel>,
    @InjectRepository(AvailabilityEventModel)
    private readonly eventRepository: Repository<AvailabilityEventModel>,
    private readonly usersService: UsersService
  ) {}

  async getMyAvailability(userId: string) {
    return this.getOrCreateAvailability(userId);
  }

  async getTeamAvailability(
    requesterId: string,
    requesterRole: UserRole,
    filter?: TeamAvailabilityFilter
  ) {
    const requester = await this.usersService.findOneById(requesterId);
    if (!requester) {
      throw new NotFoundException("User not found");
    }

    const query = this.availabilityRepository
      .createQueryBuilder("availability")
      .innerJoinAndSelect("availability.user", "user")
      .leftJoinAndSelect("user.profile", "profile")
      .leftJoinAndSelect("user.department", "department");

    if (requesterRole !== UserRole.Admin) {
      if (!requester.department) {
        const mine = await this.getMyAvailability(requesterId);
        if (filter?.status && mine.status !== filter.status) {
          return [];
        }
        return [mine];
      }
      query.andWhere("department.id = :departmentId", {
        departmentId: requester.department.id,
      });
    } else if (filter?.departmentId) {
      query.andWhere("department.id = :departmentId", {
        departmentId: filter.departmentId,
      });
    }

    if (filter?.status) {
      query.andWhere("availability.status = :status", { status: filter.status });
    }

    let results = await query.getMany();

    const includesRequester = results.some(
      (row) => String(row.userId) === String(requesterId)
    );

    if (!includesRequester) {
      const mine = await this.getMyAvailability(requesterId);
      if (!filter?.status || mine.status === filter.status) {
        results = [...results, mine];
      }
    }

    return results;
  }

  getAvailabilityHistory(userId: string) {
    return this.eventRepository.find({
      where: { userId },
      order: { updatedAt: "DESC" },
    });
  }

  async setAvailability(
    actorId: string,
    actorRole: UserRole,
    input: SetAvailabilityInput
  ) {
    const targetUserId = input.userId ?? actorId;

    if (targetUserId !== actorId && actorRole !== UserRole.Admin) {
      throw new ForbiddenException("You can only update your own availability");
    }

    const updatedBy =
      input.updatedBy ??
      (targetUserId === actorId
        ? AvailabilityUpdatedBy.USER
        : AvailabilityUpdatedBy.ADMIN);

    return this.applyAvailability(targetUserId, { ...input, updatedBy });
  }

  async setAvailabilityFromBot(userId: string, input: SetAvailabilityInput) {
    return this.applyAvailability(userId, {
      ...input,
      userId,
      updatedBy: AvailabilityUpdatedBy.BOT,
    });
  }

  private async applyAvailability(targetUserId: string, input: SetAvailabilityInput) {
    const userId = String(targetUserId);
    const user = await this.usersService.findOneById(userId);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const updatedBy = input.updatedBy ?? AvailabilityUpdatedBy.USER;

    await this.ensureAvailabilityRecord(userId);

    await this.availabilityRepository.update(
      { userId },
      {
        status: input.status,
        note: input.note ?? null,
        effectiveFrom: input.effectiveFrom ?? null,
        effectiveTo: input.effectiveTo ?? null,
        updatedBy,
      }
    );

    await this.eventRepository.save(
      this.eventRepository.create({
        userId,
        status: input.status,
        note: input.note,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        updatedBy,
      })
    );

    return this.availabilityRepository.findOne({
      where: { userId },
      relations: ["user", "user.profile", "user.department", "user.position"],
    });
  }

  private async ensureAvailabilityRecord(userId: string) {
    const normalizedUserId = String(userId);
    const existing = await this.availabilityRepository.findOne({
      where: { userId: normalizedUserId },
    });

    if (existing) {
      return existing;
    }

    try {
      return await this.availabilityRepository.save(
        this.availabilityRepository.create({
          userId: normalizedUserId,
          status: AvailabilityStatus.UNKNOWN,
          updatedBy: AvailabilityUpdatedBy.USER,
        })
      );
    } catch {
      return this.availabilityRepository.findOne({
        where: { userId: normalizedUserId },
      });
    }
  }

  private async getOrCreateAvailability(userId: string) {
    const normalizedUserId = String(userId);
    const existing = await this.availabilityRepository.findOne({
      where: { userId: normalizedUserId },
      relations: ["user", "user.profile", "user.department", "user.position"],
    });

    if (existing) {
      return existing;
    }

    await this.ensureAvailabilityRecord(normalizedUserId);

    return this.availabilityRepository.findOne({
      where: { userId: normalizedUserId },
      relations: ["user", "user.profile", "user.department", "user.position"],
    });
  }
}
