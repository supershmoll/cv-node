import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";
import { AvailabilityStatus, AvailabilityUpdatedBy, UserAvailability } from "src/graphql";
import { UserModel } from "src/users/model/user.model";

@Entity("user_availability")
export class UserAvailabilityModel implements UserAvailability {
  @PrimaryColumn("int")
  userId: string;

  @OneToOne(() => UserModel, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: UserModel;

  @Column("enum", { enum: AvailabilityStatus, default: AvailabilityStatus.UNKNOWN })
  status: AvailabilityStatus;

  @Column("varchar", { nullable: true })
  note?: string;

  @Column("timestamptz", { nullable: true })
  effectiveFrom?: string;

  @Column("timestamptz", { nullable: true })
  effectiveTo?: string;

  @UpdateDateColumn()
  updatedAt: string;

  @Column("enum", { enum: AvailabilityUpdatedBy, default: AvailabilityUpdatedBy.USER })
  updatedBy: AvailabilityUpdatedBy;
}
