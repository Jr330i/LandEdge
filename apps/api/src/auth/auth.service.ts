import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtAccessPayload } from './jwt.types';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
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
}
