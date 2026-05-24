import { UserRole } from '@prisma/client';

/**
 * Admin console roles: internal staff that can access back-office APIs.
 * Tenant/owner portal roles are intentionally excluded.
 */
export const CONSOLE_ACCESS_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ORG_ADMIN,
  UserRole.PORTFOLIO_MANAGER,
  UserRole.FINANCE,
  UserRole.FACILITIES_MANAGER,
  UserRole.READ_ONLY,
];
