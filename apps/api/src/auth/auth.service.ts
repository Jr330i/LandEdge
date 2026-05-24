import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import type {
  JwtAccessPayload,
  JwtPasswordResetPayload,
} from './jwt.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  async login(dto: LoginDto) {
    return this.prisma.withLoginRls(async (tx) => {
      const org = await tx.organization.findUnique({
        where: { slug: dto.organizationSlug.trim().toLowerCase() },
      });
      if (!org) {
        throw new UnauthorizedException('Invalid organization or credentials');
      }

      const user = await tx.user.findUnique({
        where: {
          organizationId_email: {
            organizationId: org.id,
            email: dto.email.trim().toLowerCase(),
          },
        },
      });

      if (!user?.passwordHash) {
        throw new UnauthorizedException('Invalid organization or credentials');
      }

      const ok = await bcrypt.compare(dto.password, user.passwordHash);
      if (!ok) {
        throw new UnauthorizedException('Invalid organization or credentials');
      }

      const payload: JwtAccessPayload = {
        sub: user.id,
        email: user.email,
        organizationId: user.organizationId,
        role: user.role,
        typ: 'access',
      };

      const access_token = await this.jwt.signAsync(payload);

      return {
        access_token,
        token_type: 'Bearer' as const,
        user: {
          id: user.id,
          email: user.email,
          organizationId: user.organizationId,
          organizationName: org.name,
          organizationSlug: org.slug,
          role: user.role,
          displayName: user.displayName,
        },
      };
    });
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ ok: true }> {
    const slug = dto.organizationSlug.trim().toLowerCase();
    const email = dto.email.trim().toLowerCase();

    await this.prisma.withLoginRls(async (tx) => {
      const org = await tx.organization.findUnique({ where: { slug } });
      if (!org) return;

      const user = await tx.user.findUnique({
        where: {
          organizationId_email: { organizationId: org.id, email },
        },
      });
      if (!user) return;

      if (!this.mail.isConfigured()) return;

      const token = await this.createPasswordResetToken({
        sub: user.id,
        email: user.email,
        organizationId: org.id,
        organizationSlug: org.slug,
        typ: 'password_reset',
      });

      const resetUrl = this.mail.passwordResetUrl(token);
      const name = user.displayName?.trim() || user.email;
      await this.mail.send({
        to: user.email,
        subject: `Reset your Sofinda password · ${org.name}`,
        text: [
          `Hi ${name},`,
          '',
          'We received a request to reset your Sofinda password.',
          `Organization: ${org.name} (${org.slug})`,
          '',
          `Set a new password: ${resetUrl}`,
          '',
          'This link expires in 24 hours. If you did not request this, you can ignore this email.',
        ].join('\n'),
      });
    });

    return { ok: true };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ ok: true }> {
    let payload: JwtPasswordResetPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPasswordResetPayload>(dto.token);
    } catch {
      throw new BadRequestException('Invalid or expired reset link');
    }
    if (payload.typ !== 'password_reset') {
      throw new BadRequestException('Invalid or expired reset link');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    await this.prisma.withLoginRls(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: payload.sub } });
      if (
        !user ||
        user.email !== payload.email ||
        user.organizationId !== payload.organizationId
      ) {
        throw new BadRequestException('Invalid or expired reset link');
      }
      const org = await tx.organization.findUnique({
        where: { id: user.organizationId },
      });
      if (!org || org.slug !== payload.organizationSlug) {
        throw new BadRequestException('Invalid or expired reset link');
      }
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });
    });

    return { ok: true };
  }

  async createPasswordResetToken(
    payload: JwtPasswordResetPayload,
  ): Promise<string> {
    return this.jwt.signAsync(payload, { expiresIn: '24h' });
  }

  async sendInviteEmail(input: {
    email: string;
    displayName?: string | null;
    organizationName: string;
    organizationSlug: string;
    userId: string;
    organizationId: string;
  }): Promise<boolean> {
    if (!this.mail.isConfigured()) return false;

    const token = await this.createPasswordResetToken({
      sub: input.userId,
      email: input.email,
      organizationId: input.organizationId,
      organizationSlug: input.organizationSlug,
      typ: 'password_reset',
    });
    const resetUrl = this.mail.passwordResetUrl(token);
    const name = input.displayName?.trim() || input.email;

    await this.mail.send({
      to: input.email,
      subject: `You're invited to Sofinda · ${input.organizationName}`,
      text: [
        `Hi ${name},`,
        '',
        `You've been invited to ${input.organizationName} on Sofinda.`,
        '',
        `Organization slug: ${input.organizationSlug}`,
        `Sign in email: ${input.email}`,
        '',
        `Activate your account and set a password: ${resetUrl}`,
        '',
        'This link expires in 24 hours.',
      ].join('\n'),
    });
    return true;
  }
}
