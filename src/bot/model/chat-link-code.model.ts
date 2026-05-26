import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { UserModel } from "src/users/model/user.model";

@Entity("chat_link_code")
export class ChatLinkCodeModel {
  @PrimaryColumn("varchar")
  code: string;

  @Column("int")
  userId: string;

  @ManyToOne(() => UserModel, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: UserModel;

  @Column("timestamptz")
  expiresAt: string;
}
