import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MailerModule } from "@nestjs-modules/mailer";
import { HandlebarsAdapter } from "@nestjs-modules/mailer/dist/adapters/handlebars.adapter";
import { UsersModule } from "src/users/users.module";
import { MailService } from "./mail.service";
import { MailModel } from "./model/mail.model";
import { MailResolver } from "./mail.resolver";
import { join } from "path";

@Module({
  imports: [
    TypeOrmModule.forFeature([MailModel]),
    MailerModule.forRoot({
      transport: {
        // We removed 'pool: true' so errors are thrown instantly instead of hanging!
        url: process.env.SMTP_URL,
      },
      defaults: {
        from: `"Curriculum Vitae" <${process.env.MAIL_FROM}>`,
      },
      template: {
        // Using process.cwd() guarantees it finds the folder on Railway's Docker container
        dir: join(process.cwd(), "dist/mail/templates"),
        adapter: new HandlebarsAdapter(),
        options: {
          strict: true,
        },
      },
    }),
    UsersModule,
  ],
  providers: [MailResolver, MailService],
  exports: [MailService],
})
export class MailModule {}
