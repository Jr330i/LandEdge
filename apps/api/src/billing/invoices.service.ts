import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InvoiceStatus,
  LedgerSource,
  Prisma,
  UserRole,
} from '@prisma/client';
import type { JwtAccessPayload } from '../auth/jwt.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { GenerateInvoiceFromSchedulesDto } from './dto/generate-invoice-from-schedules.dto';

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(
    actor: JwtAccessPayload,
    filters: { leaseId?: string; tenantId?: string },
  ) {
    return this.prisma.withUserRls(actor, (tx) =>
      tx.invoice.findMany({
        where: {
          ...(actor.role === UserRole.SUPER_ADMIN
            ? {}
            : { organizationId: actor.organizationId }),
          ...(filters.leaseId ? { leaseId: filters.leaseId } : {}),
          ...(filters.tenantId ? { tenantId: filters.tenantId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        include: {
          lines: true,
          lease: {
            select: { id: true, status: true },
          },
        },
      }),
    );
  }

  findOne(id: string, actor: JwtAccessPayload) {
    return this.prisma.withUserRls(actor, async (tx) => {
      const row = await tx.invoice.findUnique({
        where: { id },
        include: { lines: true, ledgerEntry: true },
      });
      if (!row) {
        throw new NotFoundException('Invoice not found');
      }
      if (
        actor.role !== UserRole.SUPER_ADMIN &&
        row.organizationId !== actor.organizationId
      ) {
        throw new NotFoundException('Invoice not found');
      }
      return row;
    });
  }

  create(actor: JwtAccessPayload, dto: CreateInvoiceDto) {
    if (!dto.lines?.length) {
      throw new BadRequestException('At least one invoice line is required');
    }
    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);
    if (periodEnd < periodStart) {
      throw new BadRequestException('periodEnd must be on or after periodStart');
    }

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

      for (const line of dto.lines) {
        if (line.chargeScheduleId) {
          const sch = await tx.chargeSchedule.findUnique({
            where: { id: line.chargeScheduleId },
          });
          if (!sch || sch.leaseId !== lease.id) {
            throw new BadRequestException(
              'chargeScheduleId must belong to the same lease',
            );
          }
        }
      }

      const total = dto.lines.reduce(
        (acc, l) => acc.add(new Prisma.Decimal(String(l.amount))),
        new Prisma.Decimal(0),
      );
      if (total.lte(0)) {
        throw new BadRequestException('Invoice total must be positive');
      }

      return tx.invoice.create({
        data: {
          organizationId: lease.organizationId,
          leaseId: lease.id,
          tenantId: lease.tenantId,
          status: InvoiceStatus.DRAFT,
          periodStart,
          periodEnd,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          currency: 'ZAR',
          notes: dto.notes ?? null,
          lines: {
            create: dto.lines.map((l) => ({
              description: l.description,
              amount: new Prisma.Decimal(String(l.amount)),
              chargeScheduleId: l.chargeScheduleId ?? null,
            })),
          },
        },
        include: { lines: true },
      });
    });
  }

  /**
   * Build a draft invoice from active charge schedules that overlap the billing period.
   * Idempotent: returns an existing draft for the same lease + period when skipIfDraftExists is true.
   */
  generateFromSchedules(
    actor: JwtAccessPayload,
    dto: GenerateInvoiceFromSchedulesDto,
  ) {
    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);
    if (periodEnd < periodStart) {
      throw new BadRequestException('periodEnd must be on or after periodStart');
    }

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

      const skipDraft = dto.skipIfDraftExists !== false;
      if (skipDraft) {
        const draft = await tx.invoice.findFirst({
          where: {
            leaseId: lease.id,
            periodStart,
            periodEnd,
            status: InvoiceStatus.DRAFT,
          },
          include: { lines: true },
        });
        if (draft) {
          return draft;
        }
      }

      const issued = await tx.invoice.findFirst({
        where: {
          leaseId: lease.id,
          periodStart,
          periodEnd,
          status: InvoiceStatus.ISSUED,
        },
      });
      if (issued) {
        throw new BadRequestException(
          'An issued invoice already exists for this lease and billing period',
        );
      }

      const schedules = await tx.chargeSchedule.findMany({
        where: {
          leaseId: lease.id,
          active: true,
          startDate: { lte: periodEnd },
          OR: [{ endDate: null }, { endDate: { gte: periodStart } }],
        },
        orderBy: [{ kind: 'asc' }, { startDate: 'asc' }],
      });

      if (!schedules.length) {
        throw new BadRequestException(
          'No active charge schedules overlap this billing period',
        );
      }

      const currencies = new Set(schedules.map((s) => s.currency));
      if (currencies.size > 1) {
        throw new BadRequestException(
          'All charge schedules for this invoice must use the same currency',
        );
      }
      const currency = schedules[0].currency;

      const lines = schedules.map((s) => {
        const label = s.label?.trim() || s.kind;
        const from = periodStart.toISOString().slice(0, 10);
        const to = periodEnd.toISOString().slice(0, 10);
        return {
          description: `${s.kind} — ${label} (${from}–${to})`,
          amount: s.amount,
          chargeScheduleId: s.id,
        };
      });

      const total = lines.reduce(
        (acc, l) => acc.add(l.amount),
        new Prisma.Decimal(0),
      );
      if (total.lte(0)) {
        throw new BadRequestException('Generated invoice total must be positive');
      }

      return tx.invoice.create({
        data: {
          organizationId: lease.organizationId,
          leaseId: lease.id,
          tenantId: lease.tenantId,
          status: InvoiceStatus.DRAFT,
          periodStart,
          periodEnd,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          currency,
          notes: 'Generated from charge schedules',
          lines: { create: lines },
        },
        include: { lines: true },
      });
    });
  }

  issue(id: string, actor: JwtAccessPayload) {
    return this.prisma.withUserRls(actor, async (tx) => {
      const inv = await tx.invoice.findUnique({
        where: { id },
        include: { lines: true, ledgerEntry: true },
      });
      if (!inv) {
        throw new NotFoundException('Invoice not found');
      }
      if (
        actor.role !== UserRole.SUPER_ADMIN &&
        inv.organizationId !== actor.organizationId
      ) {
        throw new NotFoundException('Invoice not found');
      }
      if (inv.status !== InvoiceStatus.DRAFT) {
        throw new BadRequestException('Only draft invoices can be issued');
      }
      if (inv.ledgerEntry) {
        throw new BadRequestException('Invoice already posted to ledger');
      }

      const total = inv.lines.reduce(
        (acc, l) => acc.add(l.amount),
        new Prisma.Decimal(0),
      );
      if (total.lte(0)) {
        throw new BadRequestException('Invoice has no positive total');
      }

      const narrative = `Invoice ${id.slice(0, 8)}… (${inv.periodStart.toISOString().slice(0, 10)}–${inv.periodEnd.toISOString().slice(0, 10)})`;

      await tx.ledgerEntry.create({
        data: {
          organizationId: inv.organizationId,
          leaseId: inv.leaseId,
          tenantId: inv.tenantId,
          invoiceId: inv.id,
          narrative,
          signedAmount: total,
          currency: inv.currency,
          source: LedgerSource.INVOICE,
        },
      });

      return tx.invoice.update({
        where: { id },
        data: { status: InvoiceStatus.ISSUED },
        include: { lines: true, ledgerEntry: true },
      });
    });
  }

  voidInvoice(id: string, actor: JwtAccessPayload) {
    return this.prisma.withUserRls(actor, async (tx) => {
      const inv = await tx.invoice.findUnique({
        where: { id },
        include: { ledgerEntry: true },
      });
      if (!inv) {
        throw new NotFoundException('Invoice not found');
      }
      if (
        actor.role !== UserRole.SUPER_ADMIN &&
        inv.organizationId !== actor.organizationId
      ) {
        throw new NotFoundException('Invoice not found');
      }
      if (inv.status !== InvoiceStatus.DRAFT) {
        throw new BadRequestException(
          'Only draft invoices can be voided (issued invoices are ledger-backed)',
        );
      }
      return tx.invoice.update({
        where: { id },
        data: { status: InvoiceStatus.VOID },
        include: { lines: true },
      });
    });
  }
}
