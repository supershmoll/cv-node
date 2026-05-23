import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MailerModule } from "@nestjs-modules/mailer";
import { HandlebarsAdapter } from "@nestjs-modules/mailer/dist/adapters/handlebars.adapter";
import { UsersModule } from "src/users/users.module";
import { MailService } from "./mail.service";
import { MailModel } from "./model/mail.model";
import { MailResolver } from "./mail.resolver";

@Module({
  imports: [
    TypeOrmModule.forFeature([MailModel]),
    MailerModule.forRoot({
      transport: {
        url: process.env.SMTP_URL,
        // Remove pool: true to prevent infinite hanging
        // Add explicit timeouts so it drops the spinner if it fails
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 5000,
      },
      defaults: {
        // Kept the same, but remember to make the Railway variable just the raw email address!
        from: `"Curriculum Vitae" <${process.env.MAIL_FROM}>`,
      },
      template: {
        // Fallback to process.cwd() ensures it always finds the root directory in production
        dir: process.cwd() + "/dist/mail/templates",
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
