import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtAccessPayload } from './jwt.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtAccessPayload): Promise<JwtAccessPayload> {
    if (payload.typ !== 'access') {
      throw new UnauthorizedException();
    }
    return this.prisma.withUserRls(payload, async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user) {
        throw new UnauthorizedException();
      }
      if (user.organizationId !== payload.organizationId) {
        throw new UnauthorizedException();
      }
      if (user.role !== payload.role) {
        throw new UnauthorizedException();
      }
      return {
        sub: user.id,
        email: user.email,
        organizationId: user.organizationId,
        role: user.role,
        typ: 'access',
      };
    });
  }
}
