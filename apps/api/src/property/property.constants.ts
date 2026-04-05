import { UserRole } from '@prisma/client';

/** Appendix A — who may mutate portfolio / premises (Phase 1). */
export const PROPERTY_WRITE_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ORG_ADMIN,
  UserRole.PORTFOLIO_MANAGER,
];
