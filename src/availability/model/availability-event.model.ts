import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";
import { AvailabilityEvent, AvailabilityStatus, AvailabilityUpdatedBy } from "src/graphql";

@Entity("availability_event")
export class AvailabilityEventModel implements AvailabilityEvent {
  @PrimaryGeneratedColumn()
  id: string;

  @Column("int")
  userId: string;

  @Column("enum", { enum: AvailabilityStatus })
  status: AvailabilityStatus;

  @Column("varchar", { nullable: true })
  note?: string;

  @Column("timestamptz", { nullable: true })
  effectiveFrom?: string;

  @Column("timestamptz", { nullable: true })
  effectiveTo?: string;

  @CreateDateColumn()
  updatedAt: string;

  @Column("enum", { enum: AvailabilityUpdatedBy })
  updatedBy: AvailabilityUpdatedBy;
}
