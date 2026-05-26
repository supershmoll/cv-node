import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from "typeorm";
import { AvailabilityStatus } from "src/graphql";

@Entity("daily_status_check")
@Unique(["userId", "checkDate"])
export class DailyStatusCheckModel {
  @PrimaryGeneratedColumn()
  id: string;

  @Column("int")
  userId: string;

  @Index()
  @Column("date")
  checkDate: string;

  @Column("timestamptz", { nullable: true })
  confirmedAt?: string;

  @Column("enum", { enum: AvailabilityStatus, nullable: true })
  confirmedStatus?: AvailabilityStatus;

  @Column("int", { default: 0 })
  remindersSent: number;

  @Column("boolean", { default: false })
  forceLoggedOut: boolean;
}
