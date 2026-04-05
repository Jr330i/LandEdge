import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { JwtAccessPayload } from '../auth/jwt.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(actor: JwtAccessPayload) {
    return this.prisma.withUserRls(actor, (tx) =>
      tx.tenant.findMany({
        where:
          actor.role === UserRole.SUPER_ADMIN
            ? {}
            : { organizationId: actor.organizationId },
        orderBy: { legalName: 'asc' },
        include: { _count: { select: { leases: true } } },
      }),
    );
  }

  findOne(id: string, actor: JwtAccessPayload) {
    return this.prisma.withUserRls(actor, async (tx) => {
      const row = await tx.tenant.findUnique({
        where: { id },
        include: { _count: { select: { leases: true } } },
      });
      if (!row) {
        throw new NotFoundException('Tenant not found');
      }
      if (
        actor.role !== UserRole.SUPER_ADMIN &&
        row.organizationId !== actor.organizationId
      ) {
        throw new NotFoundException('Tenant not found');
      }
      return row;
    });
  }

  create(actor: JwtAccessPayload, dto: CreateTenantDto) {
    const organizationId = actor.organizationId;
    return this.prisma.withUserRls(actor, (tx) =>
      tx.tenant.create({
        data: {
          organizationId,
          legalName: dto.legalName.trim(),
          tradingName: dto.tradingName?.trim(),
          contactEmail: dto.contactEmail?.trim().toLowerCase(),
          contactPhone: dto.contactPhone?.trim(),
        },
        include: { _count: { select: { leases: true } } },
      }),
    );
  }

  update(id: string, actor: JwtAccessPayload, dto: UpdateTenantDto) {
    return this.prisma.withUserRls(actor, async (tx) => {
      const existing = await tx.tenant.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException('Tenant not found');
      }
      if (
        actor.role !== UserRole.SUPER_ADMIN &&
        existing.organizationId !== actor.organizationId
      ) {
        throw new NotFoundException('Tenant not found');
      }
      return tx.tenant.update({
        where: { id },
        data: {
          ...(dto.legalName !== undefined && { legalName: dto.legalName.trim() }),
          ...(dto.tradingName !== undefined && {
            tradingName: dto.tradingName?.trim() ?? null,
          }),
          ...(dto.contactEmail !== undefined && {
            contactEmail: dto.contactEmail?.trim().toLowerCase() ?? null,
          }),
          ...(dto.contactPhone !== undefined && {
            contactPhone: dto.contactPhone?.trim() ?? null,
          }),
        },
        include: { _count: { select: { leases: true } } },
      });
    });
  }

  remove(id: string, actor: JwtAccessPayload) {
    return this.prisma.withUserRls(actor, async (tx) => {
      const existing = await tx.tenant.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException('Tenant not found');
      }
      if (
        actor.role !== UserRole.SUPER_ADMIN &&
        existing.organizationId !== actor.organizationId
      ) {
        throw new NotFoundException('Tenant not found');
      }
      const leaseCount = await tx.lease.count({ where: { tenantId: id } });
      if (leaseCount > 0) {
        throw new ForbiddenException(
          'Cannot delete tenant with existing leases',
        );
      }
      await tx.tenant.delete({ where: { id } });
      return { id, deleted: true };
    });
  }
}
