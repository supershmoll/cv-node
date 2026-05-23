import { BadRequestException, Injectable } from "@nestjs/common";
import { VerifyMailInput } from "src/graphql";
import { InjectRepository } from "@nestjs/typeorm";
import { MailModel } from "./model/mail.model";
import { UsersService } from "src/users/users.service";
import { Repository } from "typeorm";
import { Resend } from "resend";

@Injectable()
export class MailService {
  private resend: Resend;

  constructor(
    @InjectRepository(MailModel)
    private readonly mailRepository: Repository<MailModel>,
    private readonly usersService: UsersService,
  ) {
    // This grabs the API key from Railway
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  findOneByEmail(email: string) {
    return this.mailRepository.findOne({
      where: { email },
    });
  }

  createOneTimePassword() {
    return [...Array(6)].map(() => (Math.random() * 10) | 0).join("");
  }

  async sendVerificationEmail(email: string, url: string) {
    let mail = await this.findOneByEmail(email);
    const otp = this.createOneTimePassword();

    if (mail) {
      mail.otp = otp;
    } else {
      mail = this.mailRepository.create({ email, otp });
    }
    await this.mailRepository.save(mail);

    // Fires over HTTPS, bypassing Railway's port blocking!
    return this.resend.emails.send({
      from: `Curriculum Vitae <${process.env.MAIL_FROM}>`,
      to: email,
      subject: "Verify email",
      html: `
        <h2>Welcome to Curriculum Vitae!</h2>
        <p>Your verification code is: <strong>${otp}</strong></p>
        <p>Or click this link to verify: <a href="${url}">${url}</a></p>
        <p>This code expires in 2 hours.</p>
      `,
    });
  }

  async verifyEmail({ otp }: VerifyMailInput, email: string) {
    const mail = await this.mailRepository.findOne({
      where: { email, otp },
    });

    if (mail) {
      await this.mailRepository.delete(mail.id);
      await this.usersService.verifyUser(mail.email);
      return;
    }

    throw new BadRequestException({ message: "Invalid credentials" });
  }

  async sendResetPasswordEmail(email: string, url: string) {
    // Fires over HTTPS, bypassing Railway's port blocking!
    return this.resend.emails.send({
      from: `Curriculum Vitae <${process.env.MAIL_FROM}>`,
      to: email,
      subject: "Password Reset Request",
      html: `
        <h2>Password Reset</h2>
        <p>You requested to reset your password.</p>
        <p>Click here to create a new password: <a href="${url}">${url}</a></p>
        <p>This link expires in 10 minutes.</p>
      `,
    });
  }

  async verifyResetPasswordCode() {}
}
