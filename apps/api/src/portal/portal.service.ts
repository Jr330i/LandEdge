import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, Prisma, UserRole } from '@prisma/client';
import type { JwtAccessPayload } from '../auth/jwt.types';
import {
  assertValidPdfBuffer,
  renderInvoicePdf,
} from '../billing/invoice-pdf.builder';
import { PrismaService } from '../prisma/prisma.service';

type LinkedTenant = {
  id: string;
  legalName: string;
  tradingName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
};

function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

@Injectable()
export class PortalService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveLinkedTenant(
    tx: Prisma.TransactionClient,
    actor: JwtAccessPayload,
  ): Promise<LinkedTenant | null> {
    const email = actor.email.trim().toLowerCase();
    let tenant = await tx.tenant.findFirst({
      where: {
        organizationId: actor.organizationId,
        contactEmail: { equals: email, mode: 'insensitive' },
      },
      select: {
        id: true,
        legalName: true,
        tradingName: true,
        contactEmail: true,
        contactPhone: true,
      },
    });
    if (!tenant) {
      const orgTenants = await tx.tenant.findMany({
        where: { organizationId: actor.organizationId },
        select: {
          id: true,
          legalName: true,
          tradingName: true,
          contactEmail: true,
          contactPhone: true,
        },
        take: 2,
      });
      if (orgTenants.length === 1) tenant = orgTenants[0];
    }
    return tenant;
  }

  private async requireLinkedTenant(
    tx: Prisma.TransactionClient,
    actor: JwtAccessPayload,
  ): Promise<LinkedTenant> {
    const tenant = await this.resolveLinkedTenant(tx, actor);
    if (!tenant) {
      throw new ForbiddenException(
        'Your login is not linked to a tenant profile. Ask your org admin to link your account.',
      );
    }
    return tenant;
  }

  tenantSnapshot(actor: JwtAccessPayload) {
    return this.prisma.withUserRls(actor, async (tx) => {
      const tenant = await this.resolveLinkedTenant(tx, actor);
      if (!tenant) {
        return {
          linkedTenant: false,
          tenant: null,
          leaseSummary: { activeLeases: 0, expiringLeases: 0, totalLeases: 0 },
          statement: { balance: 0, invoiceCount: 0, ledgerCount: 0 },
          recentInvoices: [],
          recentLedger: [],
        };
      }

      const [leases, invoiceCount, ledgerAgg, invoiceRows, ledgerRows] =
        await Promise.all([
          tx.lease.findMany({
            where: { organizationId: actor.organizationId, tenantId: tenant.id },
            select: { status: true },
          }),
          tx.invoice.count({
            where: { organizationId: actor.organizationId, tenantId: tenant.id },
          }),
          tx.ledgerEntry.aggregate({
            where: { organizationId: actor.organizationId, tenantId: tenant.id },
            _sum: { signedAmount: true },
            _count: true,
          }),
          tx.invoice.findMany({
            where: { organizationId: actor.organizationId, tenantId: tenant.id },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
              id: true,
              status: true,
              periodStart: true,
              periodEnd: true,
              dueDate: true,
              currency: true,
              lines: { select: { amount: true } },
            },
          }),
          tx.ledgerEntry.findMany({
            where: { organizationId: actor.organizationId, tenantId: tenant.id },
            orderBy: { createdAt: 'desc' },
            take: 8,
            select: {
              id: true,
              narrative: true,
              signedAmount: true,
              currency: true,
              source: true,
              createdAt: true,
            },
          }),
        ]);

      return {
        linkedTenant: true,
        tenant,
        leaseSummary: {
          activeLeases: leases.filter((l) => l.status === 'ACTIVE').length,
          expiringLeases: leases.filter((l) => l.status === 'EXPIRING').length,
          totalLeases: leases.length,
        },
        statement: {
          balance: Number(ledgerAgg._sum.signedAmount ?? 0),
          invoiceCount,
          ledgerCount: ledgerAgg._count,
        },
        recentInvoices: invoiceRows.map((r) => ({
          id: r.id,
          status: r.status,
          periodStart: r.periodStart,
          periodEnd: r.periodEnd,
          dueDate: r.dueDate,
          currency: r.currency,
          totalAmount: r.lines.reduce((s, l) => s + Number(l.amount), 0),
        })),
        recentLedger: ledgerRows.map((r) => ({
          id: r.id,
          narrative: r.narrative,
          signedAmount: Number(r.signedAmount),
          currency: r.currency,
          source: r.source,
          createdAt: r.createdAt,
        })),
      };
    });
  }

  tenantInvoices(
    actor: JwtAccessPayload,
    params: { status?: InvoiceStatus; page?: number; pageSize?: number } = {},
  ) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    return this.prisma.withUserRls(actor, async (tx) => {
      const tenant = await this.requireLinkedTenant(tx, actor);
      const where: Prisma.InvoiceWhereInput = {
        organizationId: actor.organizationId,
        tenantId: tenant.id,
        ...(params.status ? { status: params.status } : {}),
      };
      const [total, rows] = await Promise.all([
        tx.invoice.count({ where }),
        tx.invoice.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            status: true,
            periodStart: true,
            periodEnd: true,
            dueDate: true,
            currency: true,
            createdAt: true,
            lines: { select: { amount: true } },
          },
        }),
      ]);
      return {
        items: rows.map((r) => ({
          id: r.id,
          status: r.status,
          periodStart: r.periodStart,
          periodEnd: r.periodEnd,
          dueDate: r.dueDate,
          currency: r.currency,
          createdAt: r.createdAt,
          totalAmount: r.lines.reduce((s, l) => s + Number(l.amount), 0),
        })),
        total,
        page,
        pageSize,
      };
    });
  }

  tenantInvoice(actor: JwtAccessPayload, invoiceId: string) {
    return this.prisma.withUserRls(actor, async (tx) => {
      const tenant = await this.requireLinkedTenant(tx, actor);
      const inv = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          lines: { orderBy: { createdAt: 'asc' } },
          organization: { select: { name: true, slug: true } },
        },
      });
      if (
        !inv ||
        inv.organizationId !== actor.organizationId ||
        inv.tenantId !== tenant.id
      ) {
        throw new NotFoundException('Invoice not found');
      }
      return {
        id: inv.id,
        status: inv.status,
        periodStart: inv.periodStart,
        periodEnd: inv.periodEnd,
        dueDate: inv.dueDate,
        currency: inv.currency,
        notes: inv.notes,
        createdAt: inv.createdAt,
        organizationName: inv.organization.name,
        lines: inv.lines.map((l) => ({
          id: l.id,
          description: l.description,
          amount: Number(l.amount),
        })),
        totalAmount: inv.lines.reduce((s, l) => s + Number(l.amount), 0),
      };
    });
  }

  async tenantInvoicePdf(
    actor: JwtAccessPayload,
    invoiceId: string,
  ): Promise<Buffer> {
    const row = await this.prisma.withUserRls(actor, async (tx) => {
      const tenant = await this.requireLinkedTenant(tx, actor);
      const inv = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          lines: { orderBy: { createdAt: 'asc' } },
          tenant: {
            select: {
              legalName: true,
              tradingName: true,
              contactEmail: true,
              contactPhone: true,
            },
          },
          organization: { select: { name: true, slug: true, settings: true } },
        },
      });
      if (
        !inv ||
        inv.organizationId !== actor.organizationId ||
        inv.tenantId !== tenant.id
      ) {
        throw new NotFoundException('Invoice not found');
      }
      return inv;
    });
    const buffer = await renderInvoicePdf(row);
    assertValidPdfBuffer(buffer);
    return buffer;
  }

  tenantStatement(
    actor: JwtAccessPayload,
    params: { page?: number; pageSize?: number } = {},
  ) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));
    return this.prisma.withUserRls(actor, async (tx) => {
      const tenant = await this.requireLinkedTenant(tx, actor);
      const where = {
        organizationId: actor.organizationId,
        tenantId: tenant.id,
      };
      const [total, rows, agg] = await Promise.all([
        tx.ledgerEntry.count({ where }),
        tx.ledgerEntry.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            narrative: true,
            signedAmount: true,
            currency: true,
            source: true,
            createdAt: true,
            invoiceId: true,
          },
        }),
        tx.ledgerEntry.aggregate({
          where,
          _sum: { signedAmount: true },
        }),
      ]);
      return {
        balance: Number(agg._sum.signedAmount ?? 0),
        items: rows.map((r) => ({
          id: r.id,
          narrative: r.narrative,
          signedAmount: Number(r.signedAmount),
          currency: r.currency,
          source: r.source,
          createdAt: r.createdAt,
          invoiceId: r.invoiceId,
        })),
        total,
        page,
        pageSize,
      };
    });
  }

  tenantLeases(actor: JwtAccessPayload) {
    return this.prisma.withUserRls(actor, async (tx) => {
      const tenant = await this.requireLinkedTenant(tx, actor);
      const rows = await tx.lease.findMany({
        where: { organizationId: actor.organizationId, tenantId: tenant.id },
        orderBy: { startDate: 'desc' },
        select: {
          id: true,
          status: true,
          startDate: true,
          endDate: true,
          leaseUnits: {
            select: {
              unit: {
                select: {
                  code: true,
                  floor: {
                    select: {
                      name: true,
                      building: { select: { name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });
      return {
        items: rows.map((l) => ({
          id: l.id,
          status: l.status,
          startDate: l.startDate,
          endDate: l.endDate,
          units: l.leaseUnits.map((lu) => ({
            code: lu.unit.code,
            floor: lu.unit.floor.name,
            building: lu.unit.floor.building.name,
          })),
        })),
      };
    });
  }

  ownerSnapshot(actor: JwtAccessPayload) {
    if (actor.role !== UserRole.OWNER_USER) {
      throw new ForbiddenException('Owner portal only');
    }
    return this.prisma.withUserRls(actor, async (tx) => {
      const [org, portfolios, buildings, units, leases, recentInvoices, issuedCount, draftCount, ledgerAgg] =
        await Promise.all([
          tx.organization.findUnique({
            where: { id: actor.organizationId },
            select: { id: true, name: true, slug: true },
          }),
          tx.portfolio.count({
            where: { organizationId: actor.organizationId },
          }),
          tx.building.count({
            where: { portfolio: { organizationId: actor.organizationId } },
          }),
          tx.unit.count({
            where: {
              floor: {
                building: {
                  portfolio: { organizationId: actor.organizationId },
                },
              },
            },
          }),
          tx.lease.findMany({
            where: { organizationId: actor.organizationId },
            select: { status: true },
          }),
          tx.invoice.findMany({
            where: { organizationId: actor.organizationId },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
              id: true,
              status: true,
              periodStart: true,
              periodEnd: true,
              currency: true,
              tenant: { select: { legalName: true, tradingName: true } },
              lines: { select: { amount: true } },
            },
          }),
          tx.invoice.count({
            where: {
              organizationId: actor.organizationId,
              status: InvoiceStatus.ISSUED,
            },
          }),
          tx.invoice.count({
            where: {
              organizationId: actor.organizationId,
              status: InvoiceStatus.DRAFT,
            },
          }),
          tx.ledgerEntry.aggregate({
            where: { organizationId: actor.organizationId },
            _sum: { signedAmount: true },
          }),
        ]);

      return {
        organization: {
          id: org?.id ?? actor.organizationId,
          name: org?.name ?? 'Organization',
          slug: org?.slug ?? 'unknown',
        },
        properties: { portfolios, buildings, units },
        occupancy: {
          activeLeases: leases.filter((l) => l.status === 'ACTIVE').length,
          expiringLeases: leases.filter((l) => l.status === 'EXPIRING').length,
          totalLeases: leases.length,
        },
        finance: {
          issuedInvoices: issuedCount,
          draftInvoices: draftCount,
          ledgerBalance: Number(ledgerAgg._sum.signedAmount ?? 0),
        },
        recentInvoices: recentInvoices.map((i) => ({
          id: i.id,
          status: i.status,
          periodStart: i.periodStart,
          periodEnd: i.periodEnd,
          currency: i.currency,
          tenantName: i.tenant.tradingName || i.tenant.legalName,
          totalAmount: i.lines.reduce((s, l) => s + Number(l.amount), 0),
        })),
      };
    });
  }

  ownerProperties(actor: JwtAccessPayload) {
    if (actor.role !== UserRole.OWNER_USER) {
      throw new ForbiddenException('Owner portal only');
    }
    return this.prisma.withUserRls(actor, async (tx) => {
      const portfolios = await tx.portfolio.findMany({
        where: { organizationId: actor.organizationId },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          region: true,
          buildings: {
            select: {
              id: true,
              name: true,
              address: true,
              floors: {
                select: {
                  _count: { select: { units: true } },
                },
              },
            },
          },
        },
      });
      return {
        items: portfolios.map((p) => {
          const buildingCount = p.buildings.length;
          const unitCount = p.buildings.reduce(
            (sum, b) =>
              sum + b.floors.reduce((fs, f) => fs + f._count.units, 0),
            0,
          );
          return {
            id: p.id,
            name: p.name,
            region: p.region,
            buildingCount,
            unitCount,
            buildings: p.buildings.map((b) => ({
              id: b.id,
              name: b.name,
              address: b.address,
              unitCount: b.floors.reduce((s, f) => s + f._count.units, 0),
            })),
          };
        }),
      };
    });
  }

  ownerInvoices(
    actor: JwtAccessPayload,
    params: { status?: InvoiceStatus; page?: number; pageSize?: number } = {},
  ) {
    if (actor.role !== UserRole.OWNER_USER) {
      throw new ForbiddenException('Owner portal only');
    }
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    return this.prisma.withUserRls(actor, async (tx) => {
      const where: Prisma.InvoiceWhereInput = {
        organizationId: actor.organizationId,
        ...(params.status ? { status: params.status } : {}),
      };
      const [total, rows] = await Promise.all([
        tx.invoice.count({ where }),
        tx.invoice.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            status: true,
            periodStart: true,
            periodEnd: true,
            dueDate: true,
            currency: true,
            createdAt: true,
            tenant: { select: { legalName: true, tradingName: true } },
            lines: { select: { amount: true } },
          },
        }),
      ]);
      return {
        items: rows.map((r) => ({
          id: r.id,
          status: r.status,
          periodStart: r.periodStart,
          periodEnd: r.periodEnd,
          dueDate: r.dueDate,
          currency: r.currency,
          createdAt: r.createdAt,
          tenantName: r.tenant.tradingName || r.tenant.legalName,
          totalAmount: r.lines.reduce((s, l) => s + Number(l.amount), 0),
        })),
        total,
        page,
        pageSize,
      };
    });
  }

  ownerInvoice(actor: JwtAccessPayload, invoiceId: string) {
    if (actor.role !== UserRole.OWNER_USER) {
      throw new ForbiddenException('Owner portal only');
    }
    return this.prisma.withUserRls(actor, async (tx) => {
      const inv = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          lines: { orderBy: { createdAt: 'asc' } },
          tenant: {
            select: { legalName: true, tradingName: true, contactEmail: true },
          },
          organization: { select: { name: true, slug: true } },
        },
      });
      if (!inv || inv.organizationId !== actor.organizationId) {
        throw new NotFoundException('Invoice not found');
      }
      return {
        id: inv.id,
        status: inv.status,
        periodStart: inv.periodStart,
        periodEnd: inv.periodEnd,
        dueDate: inv.dueDate,
        currency: inv.currency,
        notes: inv.notes,
        createdAt: inv.createdAt,
        organizationName: inv.organization.name,
        tenantName: inv.tenant.tradingName || inv.tenant.legalName,
        tenantEmail: inv.tenant.contactEmail,
        lines: inv.lines.map((l) => ({
          id: l.id,
          description: l.description,
          amount: Number(l.amount),
        })),
        totalAmount: inv.lines.reduce((s, l) => s + Number(l.amount), 0),
      };
    });
  }

  async ownerInvoicePdf(
    actor: JwtAccessPayload,
    invoiceId: string,
  ): Promise<Buffer> {
    if (actor.role !== UserRole.OWNER_USER) {
      throw new ForbiddenException('Owner portal only');
    }
    const row = await this.prisma.withUserRls(actor, async (tx) => {
      const inv = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          lines: { orderBy: { createdAt: 'asc' } },
          tenant: {
            select: {
              legalName: true,
              tradingName: true,
              contactEmail: true,
              contactPhone: true,
            },
          },
          organization: { select: { name: true, slug: true, settings: true } },
        },
      });
      if (!inv || inv.organizationId !== actor.organizationId) {
        throw new NotFoundException('Invoice not found');
      }
      return inv;
    });
    const buffer = await renderInvoicePdf(row);
    assertValidPdfBuffer(buffer);
    return buffer;
  }

  tenantStatementCsv(actor: JwtAccessPayload) {
    return this.prisma.withUserRls(actor, async (tx) => {
      const tenant = await this.requireLinkedTenant(tx, actor);
      const rows = await tx.ledgerEntry.findMany({
        where: {
          organizationId: actor.organizationId,
          tenantId: tenant.id,
        },
        orderBy: { createdAt: 'asc' },
      });

      const header = [
        'created_at',
        'source',
        'narrative',
        'signed_amount',
        'currency',
        'invoice_id',
      ].join(',');

      const lines = rows.map((r) =>
        [
          r.createdAt.toISOString(),
          r.source,
          csvEscape(r.narrative),
          r.signedAmount.toFixed(2),
          r.currency,
          r.invoiceId ?? '',
        ].join(','),
      );

      return [header, ...lines].join('\n') + '\n';
    });
  }
}
