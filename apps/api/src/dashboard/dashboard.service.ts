import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { JwtAccessPayload } from '../auth/jwt.types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  metrics(actor: JwtAccessPayload) {
    const orgFilter =
      actor.role === UserRole.SUPER_ADMIN
        ? {}
        : { organizationId: actor.organizationId };
    return this.prisma.withUserRls(actor, async (tx) => {
      const [leases, tenants, invoices, ledgerLines] = await Promise.all([
        tx.lease.count({ where: orgFilter }),
        tx.tenant.count({ where: orgFilter }),
        tx.invoice.count({ where: orgFilter }),
        tx.ledgerEntry.count({ where: orgFilter }),
      ]);
      return { leases, tenants, invoices, ledgerLines };
    });
  }
}
