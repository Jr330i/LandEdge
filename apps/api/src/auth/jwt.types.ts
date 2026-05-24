import type { UserRole } from '@prisma/client';

export type JwtAccessPayload = {
  sub: string;
  email: string;
  organizationId: string;
  role: UserRole;
  typ: 'access';
};

export type JwtPasswordResetPayload = {
  sub: string;
  email: string;
  organizationId: string;
  organizationSlug: string;
  typ: 'password_reset';
};
