import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeaseStatus, Prisma, UnitStatus, UserRole } from '@prisma/client';
import type { JwtAccessPayload } from '../auth/jwt.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeaseDto } from './dto/create-lease.dto';
import { UpdateLeaseDto } from './dto/update-lease.dto';

const LEASED_UNIT_STATUSES: LeaseStatus[] = [
  LeaseStatus.ACTIVE,
  LeaseStatus.APPROVED,
  LeaseStatus.EXPIRING,
];

/** Leases in these states reserve the unit for overlap checks (PRD — no double-booking). */
const LEASE_OVERLAP_BLOCKING: LeaseStatus[] = [
  LeaseStatus.ACTIVE,
  LeaseStatus.APPROVED,
  LeaseStatus.EXPIRING,
  LeaseStatus.UNDER_REVIEW,
  LeaseStatus.RENEWED,
];

@Injectable()
export class LeasesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(actor: JwtAccessPayload, tenantId?: string) {
    return this.prisma.withUserRls(actor, (tx) =>
      tx.lease.findMany({
        where: {
          ...(actor.role === UserRole.SUPER_ADMIN
            ? {}
            : { organizationId: actor.organizationId }),
          ...(tenantId ? { tenantId } : {}),
        },
        orderBy: { startDate: 'desc' },
        include: {
          tenant: { select: { id: true, legalName: true, tradingName: true } },
          leaseUnits: { include: { unit: { select: { id: true, code: true } } } },
        },
      }),
    );
  }

  findOne(id: string, actor: JwtAccessPayload) {
    return this.prisma.withUserRls(actor, async (tx) => {
      const row = await tx.lease.findUnique({
        where: { id },
        include: {
          tenant: true,
          leaseUnits: { include: { unit: true } },
        },
      });
      if (!row) {
        throw new NotFoundException('Lease not found');
      }
      if (
        actor.role !== UserRole.SUPER_ADMIN &&
        row.organizationId !== actor.organizationId
      ) {
        throw new NotFoundException('Lease not found');
      }
      return row;
    });
  }

  create(actor: JwtAccessPayload, dto: CreateLeaseDto) {
    if (!dto.units?.length) {
      throw new BadRequestException('At least one unit is required');
    }
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (end < start) {
      throw new BadRequestException('endDate must be on or after startDate');
    }

    return this.prisma.withUserRls(actor, async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: dto.tenantId },
      });
      if (!tenant) {
        throw new NotFoundException('Tenant not found');
      }
      if (
        actor.role !== UserRole.SUPER_ADMIN &&
        tenant.organizationId !== actor.organizationId
      ) {
        throw new NotFoundException('Tenant not found');
      }

      const orgId = tenant.organizationId;

      for (const line of dto.units) {
        await this.assertUnitInOrganization(tx, line.unitId, orgId);
      }

      const status = dto.status ?? LeaseStatus.DRAFT;
      const unitIds = dto.units.map((u) => u.unitId);
      await this.assertNoOverlappingLease(
        tx,
        unitIds,
        start,
        end,
        status,
        undefined,
      );

      const lease = await tx.lease.create({
        data: {
          organizationId: orgId,
          tenantId: tenant.id,
          startDate: start,
          endDate: end,
          status,
          terms: (dto.terms ?? {}) as Prisma.InputJsonValue,
          leaseUnits: {
            create: dto.units.map((u) => ({
              unitId: u.unitId,
              percentageAllocated: u.percentageAllocated ?? 100,
            })),
          },
        },
        include: {
          tenant: { select: { id: true, legalName: true, tradingName: true } },
          leaseUnits: { include: { unit: { select: { id: true, code: true } } } },
        },
      });

      if (LEASED_UNIT_STATUSES.includes(lease.status)) {
        await this.markUnitsLeased(tx, lease.id);
      }

      return lease;
    });
  }

  update(id: string, actor: JwtAccessPayload, dto: UpdateLeaseDto) {
    return this.prisma.withUserRls(actor, async (tx) => {
      const existing = await tx.lease.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException('Lease not found');
      }
      if (
        actor.role !== UserRole.SUPER_ADMIN &&
        existing.organizationId !== actor.organizationId
      ) {
        throw new NotFoundException('Lease not found');
      }

      let startDate = existing.startDate;
      let endDate = existing.endDate;
      if (dto.startDate !== undefined) {
        startDate = new Date(dto.startDate);
      }
      if (dto.endDate !== undefined) {
        endDate = new Date(dto.endDate);
      }
      if (endDate < startDate) {
        throw new BadRequestException('endDate must be on or after startDate');
      }

      const status = dto.status ?? existing.status;

      const orgId = existing.organizationId;
      let unitIds: string[];
      if (dto.units !== undefined) {
        for (const line of dto.units) {
          await this.assertUnitInOrganization(tx, line.unitId, orgId);
        }
        unitIds = dto.units.map((u) => u.unitId);
      } else {
        const unitLinks = await tx.leaseUnit.findMany({
          where: { leaseId: id },
          select: { unitId: true },
        });
        unitIds = unitLinks.map((l) => l.unitId);
      }

      await this.assertNoOverlappingLease(
        tx,
        unitIds,
        startDate,
        endDate,
        status,
        id,
      );

      if (dto.units !== undefined) {
        await tx.leaseUnit.deleteMany({ where: { leaseId: id } });
        await tx.leaseUnit.createMany({
          data: dto.units.map((u) => ({
            leaseId: id,
            unitId: u.unitId,
            percentageAllocated: u.percentageAllocated ?? 100,
          })),
        });
      }

      const lease = await tx.lease.update({
        where: { id },
        data: {
          startDate,
          endDate,
          status,
          ...(dto.terms !== undefined && {
            terms: dto.terms as Prisma.InputJsonValue,
          }),
        },
        include: {
          tenant: { select: { id: true, legalName: true, tradingName: true } },
          leaseUnits: { include: { unit: { select: { id: true, code: true } } } },
        },
      });

      if (LEASED_UNIT_STATUSES.includes(lease.status)) {
        await this.markUnitsLeased(tx, lease.id);
      }

      return lease;
    });
  }

  remove(id: string, actor: JwtAccessPayload) {
    return this.prisma.withUserRls(actor, async (tx) => {
      const existing = await tx.lease.findUnique({
        where: { id },
        include: { leaseUnits: true },
      });
      if (!existing) {
        throw new NotFoundException('Lease not found');
      }
      if (
        actor.role !== UserRole.SUPER_ADMIN &&
        existing.organizationId !== actor.organizationId
      ) {
        throw new NotFoundException('Lease not found');
      }

      await tx.lease.delete({ where: { id } });
      return { id, deleted: true };
    });
  }

  private async assertUnitInOrganization(
    tx: Prisma.TransactionClient,
    unitId: string,
    organizationId: string,
  ) {
    const unit = await tx.unit.findUnique({
      where: { id: unitId },
      include: {
        floor: {
          include: {
            building: { include: { portfolio: { select: { organizationId: true } } } },
          },
        },
      },
    });
    if (!unit) {
      throw new NotFoundException(`Unit ${unitId} not found`);
    }
    if (unit.floor.building.portfolio.organizationId !== organizationId) {
      throw new BadRequestException(
        'Unit is not in the same organization as the tenant',
      );
    }
  }

  private async assertNoOverlappingLease(
    tx: Prisma.TransactionClient,
    unitIds: string[],
    rangeStart: Date,
    rangeEnd: Date,
    status: LeaseStatus,
    excludeLeaseId: string | undefined,
  ) {
    if (
      status === LeaseStatus.DRAFT ||
      status === LeaseStatus.TERMINATED
    ) {
      return;
    }
    if (!unitIds.length) {
      return;
    }
    const conflict = await tx.lease.findFirst({
      where: {
        ...(excludeLeaseId ? { id: { not: excludeLeaseId } } : {}),
        status: { in: LEASE_OVERLAP_BLOCKING },
        startDate: { lte: rangeEnd },
        endDate: { gte: rangeStart },
        leaseUnits: { some: { unitId: { in: unitIds } } },
      },
      select: { id: true },
    });
    if (conflict) {
      throw new BadRequestException(
        'One or more units already have an overlapping lease in an active lifecycle state',
      );
    }
  }

  private async markUnitsLeased(tx: Prisma.TransactionClient, leaseId: string) {
    const links = await tx.leaseUnit.findMany({
      where: { leaseId },
      select: { unitId: true },
    });
    for (const { unitId } of links) {
      await tx.unit.update({
        where: { id: unitId },
        data: { status: UnitStatus.LEASED },
      });
    }
  }
}
