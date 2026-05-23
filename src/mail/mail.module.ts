import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersModule } from "src/users/users.module";
import { MailService } from "./mail.service";
import { MailModel } from "./model/mail.model";
import { MailResolver } from "./mail.resolver";

@Module({
  imports: [TypeOrmModule.forFeature([MailModel]), UsersModule],
  providers: [MailResolver, MailService],
  exports: [MailService],
})
export class MailModule {}
