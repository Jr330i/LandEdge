import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UserRole } from '@prisma/client';
import type { JwtAccessPayload } from '../auth/jwt.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChargeScheduleDto } from './dto/create-charge-schedule.dto';
import { UpdateChargeScheduleDto } from './dto/update-charge-schedule.dto';

@Injectable()
export class ChargeSchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  findAllForLease(actor: JwtAccessPayload, leaseId: string) {
    return this.prisma.withUserRls(actor, async (tx) => {
      const lease = await tx.lease.findUnique({ where: { id: leaseId } });
      if (!lease) {
        throw new NotFoundException('Lease not found');
      }
      if (
        actor.role !== UserRole.SUPER_ADMIN &&
        lease.organizationId !== actor.organizationId
      ) {
        throw new NotFoundException('Lease not found');
      }
      return tx.chargeSchedule.findMany({
        where: { leaseId },
        orderBy: [
          { sortOrder: 'asc' },
          { startDate: 'asc' },
          { kind: 'asc' },
          { id: 'asc' },
        ],
      });
    });
  }

  create(actor: JwtAccessPayload, dto: CreateChargeScheduleDto) {
    const start = new Date(dto.startDate);
    const end = dto.endDate ? new Date(dto.endDate) : null;
    if (end && end < start) {
      throw new BadRequestException('endDate must be on or after startDate');
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

      const agg = await tx.chargeSchedule.aggregate({
        where: { leaseId: lease.id },
        _max: { sortOrder: true },
      });
      const nextOrder = (agg._max.sortOrder ?? -1) + 1;

      return tx.chargeSchedule.create({
        data: {
          organizationId: lease.organizationId,
          leaseId: lease.id,
          kind: dto.kind,
          label: dto.label ?? null,
          amount: new Prisma.Decimal(String(dto.amount)),
          currency: dto.currency ?? 'ZAR',
          frequency: dto.frequency,
          startDate: start,
          endDate: end,
          active: dto.active ?? true,
          sortOrder: nextOrder,
        },
      });
    });
  }

  reorder(leaseId: string, orderedIds: string[], actor: JwtAccessPayload) {
    return this.prisma.withUserRls(actor, async (tx) => {
      const lease = await tx.lease.findUnique({ where: { id: leaseId } });
      if (!lease) {
        throw new NotFoundException('Lease not found');
      }
      if (
        actor.role !== UserRole.SUPER_ADMIN &&
        lease.organizationId !== actor.organizationId
      ) {
        throw new NotFoundException('Lease not found');
      }

      const rows = await tx.chargeSchedule.findMany({
        where: { leaseId },
        select: { id: true },
      });
      const expected = new Set(rows.map((r) => r.id));
      if (orderedIds.length !== expected.size) {
        throw new BadRequestException(
          'chargeScheduleIds must list each schedule on the lease exactly once',
        );
      }
      for (const id of orderedIds) {
        if (!expected.has(id)) {
          throw new BadRequestException(
            'chargeScheduleIds must belong to the selected lease',
          );
        }
      }

      await Promise.all(
        orderedIds.map((id, i) =>
          tx.chargeSchedule.update({ where: { id }, data: { sortOrder: i } }),
        ),
      );
      return { ok: true as const };
    });
  }

  update(id: string, actor: JwtAccessPayload, dto: UpdateChargeScheduleDto) {
    return this.prisma.withUserRls(actor, async (tx) => {
      const row = await tx.chargeSchedule.findUnique({ where: { id } });
      if (!row) {
        throw new NotFoundException('Charge schedule not found');
      }
      if (
        actor.role !== UserRole.SUPER_ADMIN &&
        row.organizationId !== actor.organizationId
      ) {
        throw new NotFoundException('Charge schedule not found');
      }

      let startDate = row.startDate;
      let endDate = row.endDate;
      if (dto.startDate !== undefined) {
        startDate = new Date(dto.startDate);
      }
      if (dto.endDate !== undefined) {
        endDate =
          dto.endDate === null || dto.endDate === ''
            ? null
            : new Date(dto.endDate);
      }
      if (endDate && endDate < startDate) {
        throw new BadRequestException('endDate must be on or after startDate');
      }

      return tx.chargeSchedule.update({
        where: { id },
        data: {
          ...(dto.kind !== undefined && { kind: dto.kind }),
          ...(dto.label !== undefined && { label: dto.label }),
          ...(dto.amount !== undefined && {
            amount: new Prisma.Decimal(String(dto.amount)),
          }),
          ...(dto.currency !== undefined && { currency: dto.currency }),
          ...(dto.frequency !== undefined && { frequency: dto.frequency }),
          ...(dto.startDate !== undefined && { startDate }),
          ...(dto.endDate !== undefined && { endDate }),
          ...(dto.active !== undefined && { active: dto.active }),
        },
      });
    });
  }

  remove(id: string, actor: JwtAccessPayload) {
    return this.prisma.withUserRls(actor, async (tx) => {
      const row = await tx.chargeSchedule.findUnique({ where: { id } });
      if (!row) {
        throw new NotFoundException('Charge schedule not found');
      }
      if (
        actor.role !== UserRole.SUPER_ADMIN &&
        row.organizationId !== actor.organizationId
      ) {
        throw new NotFoundException('Charge schedule not found');
      }
      await tx.chargeSchedule.delete({ where: { id } });
      return { id, deleted: true };
    });
  }
}
