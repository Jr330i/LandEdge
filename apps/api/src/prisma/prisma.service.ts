import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, type Prisma } from '@prisma/client';
import type { JwtAccessPayload } from '../auth/jwt.types';
import {
  setLoginRlsSession,
  setSeedRlsSession,
  setUserRlsSession,
} from './rls-session';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy() {
    await this.$disconnect();
  }

  /** Credential lookup (slug + user) — enables `app.rls_login` policies only inside this transaction. */
  withLoginRls<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await setLoginRlsSession(tx);
      return fn(tx);
    });
  }

  /** JWT-backed requests: tenant + super-admin flags for normal CRUD. */
  withUserRls<T>(
    user: JwtAccessPayload,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await setUserRlsSession(tx, user.organizationId, user.role);
      return fn(tx);
    });
  }

  /** `prisma db seed` — inserts/updates under `app.rls_seed`. */
  withSeedRls<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await setSeedRlsSession(tx);
      return fn(tx);
    });
  }
}
