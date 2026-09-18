import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';

const FROM = 'Homework 32 <no-reply@homework32.dev>';

@Injectable()
export class EmailSenderService {
  constructor(private readonly mailerService: MailerService) {}

  async sendOtpEmail(to: string, otpCode: string) {
    await this.mailerService.sendMail({
      to,
      from: FROM,
      subject: `${otpCode} is your verification code`,
      text: `Your verification code is ${otpCode}. It expires in 5 minutes. If you did not request it, ignore this email.`,
      html: otpEmailTemplate(otpCode),
    });
  }

  async sendWelcomeEmail(to: string, firstName: string) {
    await this.mailerService.sendMail({
      to,
      from: FROM,
      subject: 'Welcome! Your account is verified',
      text: `Hi ${firstName}, your account is now verified and ready to use.`,
      html: welcomeEmailTemplate(firstName),
    });
  }

  async sendAccountDeactivatedEmail(to: string, firstName: string) {
    await this.mailerService.sendMail({
      to,
      from: FROM,
      subject: 'Your account has been deactivated',
      text: `Hi ${firstName}, your account was just deactivated. If this wasn't you, contact support right away.`,
      html: accountDeactivatedEmailTemplate(firstName),
    });
  }
}

function otpEmailTemplate(otpCode: string) {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;">
      <h2 style="color:#4f46e5;">Verify your email</h2>
      <p>Use the code below to finish verifying your account. It expires in 5 minutes.</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;color:#4c1d95;background:#f5f3ff;padding:16px;border-radius:8px;">${otpCode}</p>
      <p style="color:#6b7280;font-size:14px;">Didn't request this? You can safely ignore this email.</p>
    </div>
  `;
}

function welcomeEmailTemplate(firstName: string) {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;">
      <h2 style="color:#4f46e5;">Welcome, ${firstName}! 🎉</h2>
      <p>Your account is verified and ready to go. We're glad to have you with us.</p>
    </div>
  `;
}

function accountDeactivatedEmailTemplate(firstName: string) {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;">
      <h2 style="color:#b91c1c;">Account deactivated</h2>
      <p>Hi ${firstName}, your account has just been deactivated.</p>
      <p style="color:#6b7280;font-size:14px;">If you didn't do this, please contact support immediately.</p>
    </div>
  `;
}
