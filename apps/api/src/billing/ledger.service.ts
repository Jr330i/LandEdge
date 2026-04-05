import { Injectable, NotFoundException } from '@nestjs/common';
import { LedgerSource, Prisma, UserRole } from '@prisma/client';
import type { JwtAccessPayload } from '../auth/jwt.types';
import { PrismaService } from '../prisma/prisma.service';
import { ManualLedgerDto } from './dto/manual-ledger.dto';

function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(
    actor: JwtAccessPayload,
    filters: { leaseId?: string; tenantId?: string },
  ) {
    return this.prisma.withUserRls(actor, (tx) =>
      tx.ledgerEntry.findMany({
        where: {
          ...(actor.role === UserRole.SUPER_ADMIN
            ? {}
            : { organizationId: actor.organizationId }),
          ...(filters.leaseId ? { leaseId: filters.leaseId } : {}),
          ...(filters.tenantId ? { tenantId: filters.tenantId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        include: {
          lease: { select: { id: true } },
          tenant: { select: { id: true, legalName: true, tradingName: true } },
        },
      }),
    );
  }

  createManual(actor: JwtAccessPayload, dto: ManualLedgerDto) {
    return this.prisma.withUserRls(actor, async (tx) => {
      const lease = await tx.lease.findUnique({ where: { id: dto.leaseId } });
      if (!lease) {
        throw new NotFoundException('Lease not found');
      }
      if (
        actor.role !== UserRole.SUPER_ADMIN &&
        lease.organizationId !== actor.organizationId
      ) {
        throw new NotFoundException('Lease not found');
      }

      return tx.ledgerEntry.create({
        data: {
          organizationId: lease.organizationId,
          leaseId: lease.id,
          tenantId: lease.tenantId,
          invoiceId: null,
          narrative: dto.narrative,
          signedAmount: new Prisma.Decimal(String(dto.signedAmount)),
          currency: 'ZAR',
          source: dto.source,
        },
      });
    });
  }

  exportCsv(
    actor: JwtAccessPayload,
    filters: { leaseId?: string; tenantId?: string },
  ) {
    return this.prisma.withUserRls(actor, async (tx) => {
      const rows = await tx.ledgerEntry.findMany({
        where: {
          ...(actor.role === UserRole.SUPER_ADMIN
            ? {}
            : { organizationId: actor.organizationId }),
          ...(filters.leaseId ? { leaseId: filters.leaseId } : {}),
          ...(filters.tenantId ? { tenantId: filters.tenantId } : {}),
        },
        orderBy: { createdAt: 'asc' },
      });

      const header = [
        'created_at',
        'id',
        'organization_id',
        'lease_id',
        'tenant_id',
        'invoice_id',
        'source',
        'narrative',
        'signed_amount',
        'currency',
      ].join(',');

      const lines = rows.map((r) =>
        [
          r.createdAt.toISOString(),
          r.id,
          r.organizationId,
          r.leaseId,
          r.tenantId,
          r.invoiceId ?? '',
          r.source,
          csvEscape(r.narrative),
          r.signedAmount.toFixed(2),
          r.currency,
        ].join(','),
      );

      return [header, ...lines].join('\n') + '\n';
    });
  }
}
