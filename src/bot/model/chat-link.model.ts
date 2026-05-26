import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { UserModel } from "src/users/model/user.model";

export enum ChatPlatform {
  TELEGRAM = "telegram",
  GOOGLE_CHAT = "google_chat",
}

@Entity("chat_link")
export class ChatLinkModel {
  @PrimaryGeneratedColumn()
  id: string;

  @Column("varchar")
  platform: ChatPlatform;

  @Column("varchar", { unique: true })
  externalChatId: string;

  @Column("int", { unique: true })
  userId: string;

  @Column("varchar", { nullable: true })
  telegramUsername?: string;

  @ManyToOne(() => UserModel, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: UserModel;
}
