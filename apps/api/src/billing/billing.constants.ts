import { UserRole } from '@prisma/client';

/** Billing mutations: finance + org admins (portfolio managers focus on property, not AR). */
export const BILLING_WRITE_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ORG_ADMIN,
  UserRole.FINANCE,
];
