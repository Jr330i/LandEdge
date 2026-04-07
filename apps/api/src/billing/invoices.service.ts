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
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { renderInvoicePdf } from './invoice-pdf.builder';

function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const invoiceListInclude = {
  lines: true,
  lease: { select: { id: true, status: true } },
  tenant: { select: { id: true, legalName: true, tradingName: true } },
} as const;

type InvoiceListParams = {
  leaseId?: string;
  tenantId?: string;
  status?: InvoiceStatus;
  q?: string;
  periodFrom?: string;
  periodTo?: string;
  page?: number;
  pageSize?: number;
};

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  private buildListWhere(
    actor: JwtAccessPayload,
    params: InvoiceListParams,
  ): Prisma.InvoiceWhereInput {
    const { leaseId, tenantId, status, q, periodFrom, periodTo } = params;
    const qTrim = q?.trim();
    const andParts: Prisma.InvoiceWhereInput[] = [];
    if (actor.role !== UserRole.SUPER_ADMIN) {
      andParts.push({ organizationId: actor.organizationId });
    }
    if (leaseId) {
      andParts.push({ leaseId });
    }
    if (tenantId) {
      andParts.push({ tenantId });
    }
    if (status !== undefined) {
      andParts.push({ status });
    }

    const pf = periodFrom?.trim();
    const pt = periodTo?.trim();
    if (pf && pt) {
      const from = new Date(`${pf}T00:00:00.000Z`);
      const to = new Date(`${pt}T23:59:59.999Z`);
      if (
        Number.isFinite(from.getTime()) &&
        Number.isFinite(to.getTime()) &&
        from <= to
      ) {
        andParts.push({
          periodStart: { lte: to },
          periodEnd: { gte: from },
        });
      }
    } else if (pf) {
      const from = new Date(`${pf}T00:00:00.000Z`);
      if (Number.isFinite(from.getTime())) {
        andParts.push({ periodEnd: { gte: from } });
      }
    } else if (pt) {
      const to = new Date(`${pt}T23:59:59.999Z`);
      if (Number.isFinite(to.getTime())) {
        andParts.push({ periodStart: { lte: to } });
      }
    }

    if (qTrim) {
      andParts.push({
        OR: [
          { notes: { contains: qTrim, mode: 'insensitive' } },
          {
            lines: {
              some: {
                description: { contains: qTrim, mode: 'insensitive' },
              },
            },
          },
          {
            tenant: {
              legalName: { contains: qTrim, mode: 'insensitive' },
            },
          },
          {
            tenant: {
              tradingName: { contains: qTrim, mode: 'insensitive' },
            },
          },
        ],
      });
    }

    return andParts.length > 0 ? { AND: andParts } : {};
  }

  findAll(actor: JwtAccessPayload, params: InvoiceListParams = {}) {
    const { page, pageSize, q, status, periodFrom, periodTo } = params;
    const qTrim = q?.trim();
    const paged =
      page !== undefined ||
      pageSize !== undefined ||
      !!qTrim ||
      status !== undefined ||
      !!periodFrom?.trim() ||
      !!periodTo?.trim();

    const pageResolved = Math.max(1, page ?? 1);
    const pageSizeResolved = Math.min(100, Math.max(1, pageSize ?? 20));

    const where = this.buildListWhere(actor, params);

    return this.prisma.withUserRls(actor, async (tx) => {
      if (!paged) {
        return tx.invoice.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: invoiceListInclude,
        });
      }
      const [items, total] = await Promise.all([
        tx.invoice.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: invoiceListInclude,
          skip: (pageResolved - 1) * pageSizeResolved,
          take: pageSizeResolved,
        }),
        tx.invoice.count({ where }),
      ]);
      return {
        items,
        total,
        page: pageResolved,
        pageSize: pageSizeResolved,
      };
    });
  }

  exportCsv(actor: JwtAccessPayload, params: InvoiceListParams = {}) {
    const where = this.buildListWhere(actor, params);
    return this.prisma.withUserRls(actor, async (tx) => {
      const invoices = await tx.invoice.findMany({
        where,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: {
          lines: { orderBy: { id: 'asc' } },
          tenant: { select: { legalName: true, tradingName: true } },
        },
      });

      const header = [
        'invoice_id',
        'invoice_status',
        'period_start',
        'period_end',
        'due_date',
        'currency',
        'organization_id',
        'lease_id',
        'tenant_id',
        'tenant_legal_name',
        'tenant_trading_name',
        'notes',
        'invoice_created_at',
        'line_id',
        'line_description',
        'line_amount',
        'line_charge_schedule_id',
      ].join(',');

      const out: string[] = [header];
      for (const inv of invoices) {
        const base = [
          inv.id,
          inv.status,
          inv.periodStart.toISOString().slice(0, 10),
          inv.periodEnd.toISOString().slice(0, 10),
          inv.dueDate ? inv.dueDate.toISOString().slice(0, 10) : '',
          inv.currency,
          inv.organizationId,
          inv.leaseId,
          inv.tenantId,
          csvEscape(inv.tenant.legalName),
          inv.tenant.tradingName ? csvEscape(inv.tenant.tradingName) : '',
          inv.notes ? csvEscape(inv.notes) : '',
          inv.createdAt.toISOString(),
        ];
        if (inv.lines.length === 0) {
          out.push([...base, '', '', '', ''].join(','));
        } else {
          for (const line of inv.lines) {
            out.push(
              [
                ...base,
                line.id,
                csvEscape(line.description),
                line.amount.toFixed(2),
                line.chargeScheduleId ?? '',
              ].join(','),
            );
          }
        }
      }

      return out.join('\n') + '\n';
    });
  }

  findOne(id: string, actor: JwtAccessPayload) {
    return this.prisma.withUserRls(actor, async (tx) => {
      const row = await tx.invoice.findUnique({
        where: { id },
        include: {
          lines: true,
          ledgerEntry: true,
          lease: { select: { id: true, status: true } },
          tenant: { select: { id: true, legalName: true, tradingName: true } },
        },
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

  buildPdf(id: string, actor: JwtAccessPayload): Promise<Buffer> {
    return this.prisma.withUserRls(actor, async (tx) => {
      const row = await tx.invoice.findUnique({
        where: { id },
        include: {
          lines: { orderBy: { createdAt: 'asc' } },
          tenant: { select: { legalName: true, tradingName: true } },
          organization: { select: { name: true } },
        },
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
      return renderInvoicePdf(row);
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
        orderBy: [
          { sortOrder: 'asc' },
          { kind: 'asc' },
          { startDate: 'asc' },
        ],
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

  updateDraft(id: string, actor: JwtAccessPayload, dto: UpdateInvoiceDto) {
    const hasBody =
      dto.periodStart !== undefined ||
      dto.periodEnd !== undefined ||
      dto.dueDate !== undefined ||
      dto.notes !== undefined ||
      dto.lines !== undefined;
    if (!hasBody) {
      throw new BadRequestException('No fields to update');
    }

    return this.prisma.withUserRls(actor, async (tx) => {
      const inv = await tx.invoice.findUnique({
        where: { id },
        include: { lines: true },
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
        throw new BadRequestException('Only draft invoices can be updated');
      }

      const periodStart =
        dto.periodStart !== undefined
          ? new Date(dto.periodStart)
          : inv.periodStart;
      const periodEnd =
        dto.periodEnd !== undefined ? new Date(dto.periodEnd) : inv.periodEnd;
      if (periodEnd < periodStart) {
        throw new BadRequestException('periodEnd must be on or after periodStart');
      }

      let lineCreates: {
        description: string;
        amount: Prisma.Decimal;
        chargeScheduleId: string | null;
      }[];

      if (dto.lines !== undefined) {
        if (!dto.lines.length) {
          throw new BadRequestException('At least one invoice line is required');
        }
        for (const line of dto.lines) {
          if (line.chargeScheduleId) {
            const sch = await tx.chargeSchedule.findUnique({
              where: { id: line.chargeScheduleId },
            });
            if (!sch || sch.leaseId !== inv.leaseId) {
              throw new BadRequestException(
                'chargeScheduleId must belong to the same lease as the invoice',
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
        lineCreates = dto.lines.map((l) => ({
          description: l.description,
          amount: new Prisma.Decimal(String(l.amount)),
          chargeScheduleId: l.chargeScheduleId ?? null,
        }));
      } else {
        const total = inv.lines.reduce(
          (acc, l) => acc.add(l.amount),
          new Prisma.Decimal(0),
        );
        if (total.lte(0)) {
          throw new BadRequestException('Invoice total must be positive');
        }
      }

      const dueDate =
        dto.dueDate !== undefined
          ? dto.dueDate && dto.dueDate !== ''
            ? new Date(dto.dueDate)
            : null
          : undefined;

      const data: Prisma.InvoiceUpdateInput = {};
      if (dto.periodStart !== undefined) data.periodStart = periodStart;
      if (dto.periodEnd !== undefined) data.periodEnd = periodEnd;
      if (dueDate !== undefined) data.dueDate = dueDate;
      if (dto.notes !== undefined) data.notes = dto.notes;

      if (dto.lines !== undefined) {
        data.lines = {
          deleteMany: {},
          create: lineCreates!,
        };
      }

      return tx.invoice.update({
        where: { id },
        data,
        include: {
          lines: true,
          ledgerEntry: true,
          lease: { select: { id: true, status: true } },
          tenant: { select: { id: true, legalName: true, tradingName: true } },
        },
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
