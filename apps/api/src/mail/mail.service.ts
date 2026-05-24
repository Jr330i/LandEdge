import { BadRequestException, Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: Mail.Attachment[];
};

@Injectable()
export class MailService {
  isConfigured(): boolean {
    const host = process.env.SMTP_HOST?.trim();
    const port = Number.parseInt(process.env.SMTP_PORT ?? '587', 10);
    const from = process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim();
    return Boolean(host && Number.isFinite(port) && from);
  }

  assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new BadRequestException(
        'Email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER/SMTP_PASS, and SMTP_FROM.',
      );
    }
  }

  async send(input: SendMailInput): Promise<void> {
    this.assertConfigured();
    const host = process.env.SMTP_HOST!.trim();
    const port = Number.parseInt(process.env.SMTP_PORT ?? '587', 10);
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    const from = process.env.SMTP_FROM?.trim() || user!;

    const transport = nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === 'true',
      auth: user && pass ? { user, pass } : undefined,
    });

    await transport.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: input.attachments,
    });
  }

  appPublicUrl(): string {
    const raw =
      process.env.APP_PUBLIC_URL?.trim() ||
      process.env.WEB_PUBLIC_URL?.trim() ||
      'http://localhost:5173';
    return raw.replace(/\/+$/, '');
  }

  passwordResetUrl(token: string): string {
    return `${this.appPublicUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  }
}
