import { UserRole } from '@prisma/client';

/** Appendix A — lease/tenant mutations (Finance is read-only on leases). */
export const LEASE_WRITE_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ORG_ADMIN,
  UserRole.PORTFOLIO_MANAGER,
];
