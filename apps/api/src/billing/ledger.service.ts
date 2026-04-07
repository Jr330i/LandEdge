import { Injectable, NotFoundException } from '@nestjs/common';
import {
  LedgerSource,
  Prisma,
  UserRole,
} from '@prisma/client';
import type { JwtAccessPayload } from '../auth/jwt.types';
import { PrismaService } from '../prisma/prisma.service';
import { ManualLedgerDto } from './dto/manual-ledger.dto';

function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const ledgerListInclude = {
  lease: { select: { id: true } },
  tenant: { select: { id: true, legalName: true, tradingName: true } },
} as const;

type LedgerListParams = {
  leaseId?: string;
  tenantId?: string;
  source?: LedgerSource;
  q?: string;
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  pageSize?: number;
};

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(
    actor: JwtAccessPayload,
    params: LedgerListParams,
  ): Prisma.LedgerEntryWhereInput {
    const andParts: Prisma.LedgerEntryWhereInput[] = [];
    if (actor.role !== UserRole.SUPER_ADMIN) {
      andParts.push({ organizationId: actor.organizationId });
    }
    if (params.leaseId) {
      andParts.push({ leaseId: params.leaseId });
    }
    if (params.tenantId) {
      andParts.push({ tenantId: params.tenantId });
    }
    if (params.source !== undefined) {
      andParts.push({ source: params.source });
    }

    const cf = params.createdFrom?.trim();
    const ct = params.createdTo?.trim();
    if (cf && ct) {
      const from = new Date(`${cf}T00:00:00.000Z`);
      const to = new Date(`${ct}T23:59:59.999Z`);
      if (
        Number.isFinite(from.getTime()) &&
        Number.isFinite(to.getTime()) &&
        from <= to
      ) {
        andParts.push({ createdAt: { gte: from, lte: to } });
      }
    } else if (cf) {
      const from = new Date(`${cf}T00:00:00.000Z`);
      if (Number.isFinite(from.getTime())) {
        andParts.push({ createdAt: { gte: from } });
      }
    } else if (ct) {
      const to = new Date(`${ct}T23:59:59.999Z`);
      if (Number.isFinite(to.getTime())) {
        andParts.push({ createdAt: { lte: to } });
      }
    }

    const qTrim = params.q?.trim();
    if (qTrim) {
      andParts.push({
        narrative: { contains: qTrim, mode: 'insensitive' },
      });
    }

    return andParts.length > 0 ? { AND: andParts } : {};
  }

  findAll(actor: JwtAccessPayload, params: LedgerListParams = {}) {
    const {
      page,
      pageSize,
      q,
      source,
      createdFrom,
      createdTo,
    } = params;
    const qTrim = q?.trim();
    const paged =
      page !== undefined ||
      pageSize !== undefined ||
      !!qTrim ||
      source !== undefined ||
      !!createdFrom?.trim() ||
      !!createdTo?.trim();

    const pageResolved = Math.max(1, page ?? 1);
    const pageSizeResolved = Math.min(100, Math.max(1, pageSize ?? 20));
    const where = this.buildWhere(actor, params);

    return this.prisma.withUserRls(actor, async (tx) => {
      if (!paged) {
        return tx.ledgerEntry.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: ledgerListInclude,
        });
      }
      const [items, total] = await Promise.all([
        tx.ledgerEntry.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: ledgerListInclude,
          skip: (pageResolved - 1) * pageSizeResolved,
          take: pageSizeResolved,
        }),
        tx.ledgerEntry.count({ where }),
      ]);
      return {
        items,
        total,
        page: pageResolved,
        pageSize: pageSizeResolved,
      };
    });
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

  exportCsv(actor: JwtAccessPayload, params: LedgerListParams = {}) {
    return this.prisma.withUserRls(actor, async (tx) => {
      const where = this.buildWhere(actor, params);
      const rows = await tx.ledgerEntry.findMany({
        where,
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
