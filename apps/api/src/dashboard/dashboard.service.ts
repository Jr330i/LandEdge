import { Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, LedgerSource, UserRole } from '@prisma/client';
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

  profileMetrics(actor: JwtAccessPayload) {
    const orgFilter =
      actor.role === UserRole.SUPER_ADMIN
        ? {}
        : { organizationId: actor.organizationId };
    return this.prisma.withUserRls(actor, async (tx) => {
      const issuedDue = await tx.invoice.findMany({
        where: {
          ...orgFilter,
          status: InvoiceStatus.ISSUED,
          dueDate: { not: null },
        },
        select: {
          id: true,
          dueDate: true,
          leaseId: true,
          lines: { select: { amount: true } },
        },
      });

      const dueInvoices = issuedDue.length;
      const invoiceTotals = new Map<string, number>();
      const invoiceDueAt = new Map<string, Date>();
      const leaseIds = new Set<string>();
      let maxDueAt: Date | null = null;
      for (const inv of issuedDue) {
        const total = inv.lines.reduce((s, l) => s + Number(l.amount), 0);
        invoiceTotals.set(inv.id, total);
        if (inv.dueDate) {
          invoiceDueAt.set(inv.id, inv.dueDate);
          if (!maxDueAt || inv.dueDate > maxDueAt) maxDueAt = inv.dueDate;
        }
        leaseIds.add(inv.leaseId);
      }

      const creditedByDue = new Map<string, number>();
      if (dueInvoices > 0 && leaseIds.size > 0) {
        const ledgerRows = await tx.ledgerEntry.findMany({
          where: {
            ...orgFilter,
            leaseId: { in: [...leaseIds] },
            source: { in: [LedgerSource.PAYMENT, LedgerSource.ADJUSTMENT] },
            narrative: { contains: 'INV:', mode: 'insensitive' },
            ...(maxDueAt ? { createdAt: { lte: maxDueAt } } : {}),
          },
          select: { narrative: true, createdAt: true, signedAmount: true },
        });
        for (const row of ledgerRows) {
          const m = row.narrative.match(/INV:([0-9a-f-]{36})/i);
          const invId = m?.[1];
          if (!invId || !invoiceDueAt.has(invId)) continue;
          const dueAt = invoiceDueAt.get(invId)!;
          if (row.createdAt > dueAt) continue;
          const credited = -Number(row.signedAmount);
          creditedByDue.set(invId, (creditedByDue.get(invId) ?? 0) + credited);
        }
      }

      let onTimeInvoices = 0;
      for (const [invId, total] of invoiceTotals) {
        const paid = creditedByDue.get(invId) ?? 0;
        if (paid + 0.0001 >= total) onTimeInvoices += 1;
      }
      const tenantHonestyRate =
        dueInvoices > 0 ? onTimeInvoices / dueInvoices : null;

      const [payments, reversals] = await Promise.all([
        tx.ledgerEntry.findMany({
          where: {
            ...orgFilter,
            source: LedgerSource.PAYMENT,
          },
          select: { signedAmount: true },
        }),
        tx.ledgerEntry.findMany({
          where: {
            ...orgFilter,
            source: LedgerSource.ADJUSTMENT,
            narrative: { contains: 'REV:', mode: 'insensitive' },
          },
          select: { signedAmount: true },
        }),
      ]);

      const paymentsAmount = payments.reduce(
        (s, r) => s + Math.abs(Number(r.signedAmount)),
        0,
      );
      const reversalAmount = reversals.reduce(
        (s, r) => s + Math.abs(Number(r.signedAmount)),
        0,
      );
      const netRecovered = Math.max(0, paymentsAmount - reversalAmount);
      const recoveryEfficiency =
        paymentsAmount > 0 ? Math.max(0, 1 - reversalAmount / paymentsAmount) : 1;
      const collectionScore =
        (tenantHonestyRate ?? 0.5) * 70 + recoveryEfficiency * 30;

      const monthStart = (d: Date) =>
        new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
      const addMonths = (d: Date, delta: number) =>
        new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, 1));
      const now = new Date();
      const currentMonthStart = monthStart(now);
      const firstTrendMonth = addMonths(currentMonthStart, -5);
      const trendEndExclusive = addMonths(currentMonthStart, 1);

      const trendInvoices = await tx.invoice.findMany({
        where: {
          ...orgFilter,
          status: InvoiceStatus.ISSUED,
          dueDate: { gte: firstTrendMonth, lt: trendEndExclusive },
        },
        select: {
          id: true,
          dueDate: true,
          lines: { select: { amount: true } },
        },
      });
      const trendLedger = await tx.ledgerEntry.findMany({
        where: {
          ...orgFilter,
          createdAt: { gte: firstTrendMonth, lt: trendEndExclusive },
          source: { in: [LedgerSource.PAYMENT, LedgerSource.ADJUSTMENT] },
        },
        select: { narrative: true, createdAt: true, signedAmount: true, source: true },
      });
      const allInvoiceLedger = await tx.ledgerEntry.findMany({
        where: {
          ...orgFilter,
          source: { in: [LedgerSource.PAYMENT, LedgerSource.ADJUSTMENT] },
          narrative: { contains: 'INV:', mode: 'insensitive' },
          createdAt: { lt: trendEndExclusive },
        },
        select: { narrative: true, createdAt: true, signedAmount: true },
      });

      const trend = Array.from({ length: 6 }, (_, i) => {
        const start = addMonths(firstTrendMonth, i);
        const end = addMonths(start, 1);
        const label = start.toISOString().slice(0, 7);

        const monthInvoices = trendInvoices.filter(
          (inv) => inv.dueDate && inv.dueDate >= start && inv.dueDate < end,
        );
        let monthOnTime = 0;
        for (const inv of monthInvoices) {
          const invTotal = inv.lines.reduce((s, l) => s + Number(l.amount), 0);
          const paidByDue = allInvoiceLedger
            .filter((row) => {
              const m = row.narrative.match(/INV:([0-9a-f-]{36})/i);
              if (!m || m[1] !== inv.id) return false;
              return inv.dueDate ? row.createdAt <= inv.dueDate : false;
            })
            .reduce((s, row) => s + -Number(row.signedAmount), 0);
          if (paidByDue + 0.0001 >= invTotal) monthOnTime += 1;
        }
        const monthHonesty =
          monthInvoices.length > 0 ? monthOnTime / monthInvoices.length : null;

        const monthPayments = trendLedger.filter(
          (r) =>
            r.createdAt >= start &&
            r.createdAt < end &&
            r.source === LedgerSource.PAYMENT,
        );
        const monthReversals = trendLedger.filter(
          (r) =>
            r.createdAt >= start &&
            r.createdAt < end &&
            r.source === LedgerSource.ADJUSTMENT &&
            /REV:/i.test(r.narrative),
        );
        const monthPaymentsAmount = monthPayments.reduce(
          (s, r) => s + Math.abs(Number(r.signedAmount)),
          0,
        );
        const monthReversalAmount = monthReversals.reduce(
          (s, r) => s + Math.abs(Number(r.signedAmount)),
          0,
        );
        const monthNetRecovered = Math.max(0, monthPaymentsAmount - monthReversalAmount);
        const monthRecoveryEff =
          monthPaymentsAmount > 0
            ? Math.max(0, 1 - monthReversalAmount / monthPaymentsAmount)
            : 1;
        const monthCollectionScore =
          (monthHonesty ?? 0.5) * 70 + monthRecoveryEff * 30;

        return {
          label,
          collectionScore: monthCollectionScore,
          netRecovered: monthNetRecovered,
        };
      });

      return {
        user: {
          id: actor.sub,
          email: actor.email,
          role: actor.role,
          organizationId: actor.organizationId,
        },
        tenantHonesty: {
          dueInvoices,
          onTimeInvoices,
          rate: tenantHonestyRate,
        },
        recovery: {
          paymentsCount: payments.length,
          reversalsCount: reversals.length,
          paymentsAmount,
          reversalAmount,
          netRecovered,
        },
        collectionScore,
        trend,
      };
    });
  }

  orgStaff(actor: JwtAccessPayload, organizationIdParam?: string) {
    return this.prisma.withUserRls(actor, async (tx) => {
      let orgId = actor.organizationId;
      if (actor.role === UserRole.SUPER_ADMIN && organizationIdParam?.trim()) {
        const oid = organizationIdParam.trim();
        const org = await tx.organization.findUnique({ where: { id: oid } });
        if (!org) {
          throw new NotFoundException('Organization not found');
        }
        orgId = oid;
      }

      const users = await tx.user.findMany({
        where: {
          organizationId: orgId,
          role: { notIn: [UserRole.TENANT_USER, UserRole.OWNER_USER] },
        },
        select: { id: true, email: true, displayName: true, role: true },
        orderBy: { email: 'asc' },
      });
      return { organizationId: orgId, users };
    });
  }

  performance(actor: JwtAccessPayload) {
    const orgFilter =
      actor.role === UserRole.SUPER_ADMIN
        ? {}
        : { organizationId: actor.organizationId };
    return this.prisma.withUserRls(actor, async (tx) => {
      const tenants = await tx.tenant.findMany({
        where: orgFilter,
        select: {
          id: true,
          organizationId: true,
          legalName: true,
          tradingName: true,
        },
        orderBy: { legalName: 'asc' },
      });

      const distinctOrgIds =
        tenants.length > 0
          ? [...new Set(tenants.map((t) => t.organizationId))]
          : [actor.organizationId];

      const orgRows = await tx.organization.findMany({
        where: { id: { in: distinctOrgIds } },
        select: { id: true, name: true },
      });
      const orgNameById = new Map(orgRows.map((o) => [o.id, o.name]));

      const userOrgFilter =
        actor.role === UserRole.SUPER_ADMIN && tenants.length > 0
          ? { organizationId: { in: distinctOrgIds } }
          : { organizationId: actor.organizationId };

      const staffUsers = await tx.user.findMany({
        where: {
          ...userOrgFilter,
          role: { notIn: [UserRole.TENANT_USER, UserRole.OWNER_USER] },
        },
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          organizationId: true,
        },
        orderBy: { email: 'asc' },
      });

      const leasesWithBroker = await tx.lease.findMany({
        where: {
          ...orgFilter,
          brokerUserId: { not: null },
        },
        select: { id: true, brokerUserId: true },
      });
      const leaseToBroker = new Map<string, string>();
      for (const l of leasesWithBroker) {
        if (l.brokerUserId) leaseToBroker.set(l.id, l.brokerUserId);
      }
      const brokerLeaseIds = [...leaseToBroker.keys()];

      const tenantIds = tenants.map((t) => t.id);

      const issuedDue =
        tenantIds.length === 0
          ? []
          : await tx.invoice.findMany({
              where: {
                ...orgFilter,
                status: InvoiceStatus.ISSUED,
                dueDate: { not: null },
                tenantId: { in: tenantIds },
              },
              select: {
                id: true,
                tenantId: true,
                leaseId: true,
                dueDate: true,
                lines: { select: { amount: true } },
              },
            });

      let maxDueAt: Date | null = null;
      const invoiceDueAt = new Map<string, Date>();
      const invoiceTotals = new Map<string, number>();
      for (const inv of issuedDue) {
        const total = inv.lines.reduce((s, l) => s + Number(l.amount), 0);
        invoiceTotals.set(inv.id, total);
        if (inv.dueDate) {
          invoiceDueAt.set(inv.id, inv.dueDate);
          if (!maxDueAt || inv.dueDate > maxDueAt) maxDueAt = inv.dueDate;
        }
      }

      const ledgerRows = await tx.ledgerEntry.findMany({
        where: {
          ...orgFilter,
          source: { in: [LedgerSource.PAYMENT, LedgerSource.ADJUSTMENT] },
          narrative: { contains: 'INV:', mode: 'insensitive' },
          ...(maxDueAt ? { createdAt: { lte: maxDueAt } } : {}),
        },
        select: { narrative: true, createdAt: true, signedAmount: true },
      });

      const paidByDue = new Map<string, number>();
      for (const row of ledgerRows) {
        const m = row.narrative.match(/INV:([0-9a-f-]{36})/i);
        const invId = m?.[1];
        if (!invId || !invoiceDueAt.has(invId)) continue;
        const dueAt = invoiceDueAt.get(invId)!;
        if (row.createdAt > dueAt) continue;
        paidByDue.set(invId, (paidByDue.get(invId) ?? 0) + -Number(row.signedAmount));
      }

      type TenantAcc = {
        tenantId: string;
        organizationId: string;
        tenantName: string;
        dueInvoices: number;
        onTimeInvoices: number;
        paymentsCount: number;
        reversalsCount: number;
        paymentsAmount: number;
        reversalAmount: number;
      };

      const acc = new Map<string, TenantAcc>();
      for (const t of tenants) {
        acc.set(t.id, {
          tenantId: t.id,
          organizationId: t.organizationId,
          tenantName: t.tradingName || t.legalName,
          dueInvoices: 0,
          onTimeInvoices: 0,
          paymentsCount: 0,
          reversalsCount: 0,
          paymentsAmount: 0,
          reversalAmount: 0,
        });
      }

      for (const inv of issuedDue) {
        const row = acc.get(inv.tenantId);
        if (!row) continue;
        const total = invoiceTotals.get(inv.id) ?? 0;
        const paid = paidByDue.get(inv.id) ?? 0;
        row.dueInvoices += 1;
        if (paid + 0.0001 >= total) row.onTimeInvoices += 1;
      }

      const recoveryLedger =
        tenantIds.length === 0
          ? []
          : await tx.ledgerEntry.findMany({
              where: {
                ...orgFilter,
                tenantId: { in: tenantIds },
                OR: [
                  { source: LedgerSource.PAYMENT },
                  {
                    source: LedgerSource.ADJUSTMENT,
                    narrative: { contains: 'REV:', mode: 'insensitive' },
                  },
                ],
              },
              select: {
                tenantId: true,
                signedAmount: true,
                source: true,
                narrative: true,
              },
            });

      for (const row of recoveryLedger) {
        const t = acc.get(row.tenantId);
        if (!t) continue;
        const n = Number(row.signedAmount);
        if (row.source === LedgerSource.PAYMENT) {
          t.paymentsCount += 1;
          t.paymentsAmount += Math.abs(n);
        } else if (
          row.source === LedgerSource.ADJUSTMENT &&
          /REV:/i.test(row.narrative)
        ) {
          t.reversalsCount += 1;
          t.reversalAmount += Math.abs(n);
        }
      }

      type StaffAcc = {
        userId: string;
        email: string;
        displayName: string | null;
        role: UserRole;
        organizationId: string;
        assignedLeases: number;
        dueInvoices: number;
        onTimeInvoices: number;
        paymentsCount: number;
        reversalsCount: number;
        paymentsAmount: number;
        reversalAmount: number;
      };

      const staffAcc = new Map<string, StaffAcc>();
      for (const u of staffUsers) {
        staffAcc.set(u.id, {
          userId: u.id,
          email: u.email,
          displayName: u.displayName,
          role: u.role,
          organizationId: u.organizationId,
          assignedLeases: 0,
          dueInvoices: 0,
          onTimeInvoices: 0,
          paymentsCount: 0,
          reversalsCount: 0,
          paymentsAmount: 0,
          reversalAmount: 0,
        });
      }

      for (const l of leasesWithBroker) {
        const s = staffAcc.get(l.brokerUserId!);
        if (s) s.assignedLeases += 1;
      }

      for (const inv of issuedDue) {
        const brokerId = leaseToBroker.get(inv.leaseId);
        if (!brokerId) continue;
        const s = staffAcc.get(brokerId);
        if (!s) continue;
        const total = invoiceTotals.get(inv.id) ?? 0;
        const paid = paidByDue.get(inv.id) ?? 0;
        s.dueInvoices += 1;
        if (paid + 0.0001 >= total) s.onTimeInvoices += 1;
      }

      const staffRecoveryLedger =
        brokerLeaseIds.length === 0
          ? []
          : await tx.ledgerEntry.findMany({
              where: {
                ...orgFilter,
                leaseId: { in: brokerLeaseIds },
                OR: [
                  { source: LedgerSource.PAYMENT },
                  {
                    source: LedgerSource.ADJUSTMENT,
                    narrative: { contains: 'REV:', mode: 'insensitive' },
                  },
                ],
              },
              select: {
                leaseId: true,
                signedAmount: true,
                source: true,
                narrative: true,
              },
            });

      for (const row of staffRecoveryLedger) {
        const brokerId = leaseToBroker.get(row.leaseId);
        if (!brokerId) continue;
        const s = staffAcc.get(brokerId);
        if (!s) continue;
        const n = Number(row.signedAmount);
        if (row.source === LedgerSource.PAYMENT) {
          s.paymentsCount += 1;
          s.paymentsAmount += Math.abs(n);
        } else if (
          row.source === LedgerSource.ADJUSTMENT &&
          /REV:/i.test(row.narrative)
        ) {
          s.reversalsCount += 1;
          s.reversalAmount += Math.abs(n);
        }
      }

      const staffLeaderboard = [...staffAcc.values()]
        .map((t) => {
          const honestyRate =
            t.dueInvoices > 0 ? t.onTimeInvoices / t.dueInvoices : null;
          const netRecovered = Math.max(0, t.paymentsAmount - t.reversalAmount);
          const recoveryEfficiency =
            t.paymentsAmount > 0
              ? Math.max(0, 1 - t.reversalAmount / t.paymentsAmount)
              : 1;
          const collectionScore =
            (honestyRate ?? 0.5) * 70 + recoveryEfficiency * 30;

          const base = {
            userId: t.userId,
            email: t.email,
            displayName: t.displayName,
            role: t.role,
            assignedLeases: t.assignedLeases,
            dueInvoices: t.dueInvoices,
            onTimeInvoices: t.onTimeInvoices,
            honestyRate,
            paymentsCount: t.paymentsCount,
            reversalsCount: t.reversalsCount,
            paymentsAmount: t.paymentsAmount,
            reversalAmount: t.reversalAmount,
            netRecovered,
            recoveryEfficiency,
            collectionScore,
          };

          if (actor.role === UserRole.SUPER_ADMIN) {
            return {
              ...base,
              organizationId: t.organizationId,
              organizationName: orgNameById.get(t.organizationId) ?? null,
            };
          }
          return base;
        })
        .sort(
          (a, b) =>
            b.collectionScore - a.collectionScore ||
            b.netRecovered - a.netRecovered,
        );

      const tenantLeaderboard = [...acc.values()]
        .map((t) => {
          const honestyRate =
            t.dueInvoices > 0 ? t.onTimeInvoices / t.dueInvoices : null;
          const netRecovered = Math.max(0, t.paymentsAmount - t.reversalAmount);
          const recoveryEfficiency =
            t.paymentsAmount > 0
              ? Math.max(0, 1 - t.reversalAmount / t.paymentsAmount)
              : 1;
          const collectionScore =
            (honestyRate ?? 0.5) * 70 + recoveryEfficiency * 30;

          const base = {
            tenantId: t.tenantId,
            tenantName: t.tenantName,
            dueInvoices: t.dueInvoices,
            onTimeInvoices: t.onTimeInvoices,
            honestyRate,
            paymentsCount: t.paymentsCount,
            reversalsCount: t.reversalsCount,
            paymentsAmount: t.paymentsAmount,
            reversalAmount: t.reversalAmount,
            netRecovered,
            recoveryEfficiency,
            collectionScore,
          };

          if (actor.role === UserRole.SUPER_ADMIN) {
            return {
              ...base,
              organizationId: t.organizationId,
              organizationName: orgNameById.get(t.organizationId) ?? null,
            };
          }
          return base;
        })
        .sort(
          (a, b) =>
            b.collectionScore - a.collectionScore ||
            b.netRecovered - a.netRecovered,
        );

      const withHonesty = tenantLeaderboard.filter((r) => r.dueInvoices > 0);
      const avgHonestyRate =
        withHonesty.length > 0
          ? withHonesty.reduce((s, r) => s + (r.honestyRate ?? 0), 0) /
            withHonesty.length
          : null;
      const totalNetRecovered = tenantLeaderboard.reduce(
        (s, r) => s + r.netRecovered,
        0,
      );
      const avgCollectionScore =
        tenantLeaderboard.length > 0
          ? tenantLeaderboard.reduce((s, r) => s + r.collectionScore, 0) /
            tenantLeaderboard.length
          : 0;

      return {
        summary: {
          tenants: tenantLeaderboard.length,
          avgHonestyRate,
          totalNetRecovered,
          avgCollectionScore,
        },
        tenantLeaderboard,
        staffLeaderboard,
        employeeNote:
          'Staff KPIs only include invoices and ledger lines for leases with an assigned collection broker.',
      };
    });
  }
}
