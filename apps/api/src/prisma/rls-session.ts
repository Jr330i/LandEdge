import { UserRole, type Prisma } from '@prisma/client';

/**
 * PostgreSQL session vars read by RLS policies (migration 20250407120000).
 * All use set_config(..., true) so values are transaction-local (SET LOCAL).
 */
export async function setLoginRlsSession(
  tx: Prisma.TransactionClient,
): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.rls_login', 'true', true)`;
  await tx.$executeRaw`SELECT set_config('app.rls_seed', 'false', true)`;
}

export async function setSeedRlsSession(
  tx: Prisma.TransactionClient,
): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.rls_seed', 'true', true)`;
  await tx.$executeRaw`SELECT set_config('app.rls_login', 'false', true)`;
}

export async function setUserRlsSession(
  tx: Prisma.TransactionClient,
  organizationId: string,
  role: UserRole,
): Promise<void> {
  const isSuper = role === UserRole.SUPER_ADMIN;
  await tx.$executeRaw`SELECT set_config('app.current_organization_id', ${organizationId}, true)`;
  await tx.$executeRaw`SELECT set_config('app.is_super_admin', ${isSuper ? 'true' : 'false'}, true)`;
  await tx.$executeRaw`SELECT set_config('app.rls_login', 'false', true)`;
  await tx.$executeRaw`SELECT set_config('app.rls_seed', 'false', true)`;
}
