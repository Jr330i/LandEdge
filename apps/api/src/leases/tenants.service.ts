import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { JwtAccessPayload } from '../auth/jwt.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

type TenantListParams = {
  q?: string;
  page?: number;
  pageSize?: number;
};

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureTenantUserForTenant(
    tx: Parameters<Parameters<PrismaService['withUserRls']>[1]>[0],
    organizationId: string,
    contactEmail: string,
    tradingName?: string | null,
    legalName?: string | null,
  ) {
    const email = contactEmail.trim().toLowerCase();
    const existing = await tx.user.findUnique({
      where: {
        organizationId_email: {
          organizationId,
          email,
        },
      },
    });
    const displayName = tradingName?.trim() || legalName?.trim() || null;
    if (existing) {
      if (existing.role === UserRole.TENANT_USER) {
        await tx.user.update({
          where: { id: existing.id },
          data: { displayName },
        });
        return;
      }
      throw new ConflictException(
        `Contact email ${email} already belongs to a non-tenant user role`,
      );
    }
    await tx.user.create({
      data: {
        organizationId,
        email,
        role: UserRole.TENANT_USER,
        displayName,
        passwordHash: null,
      },
    });
  }

  findAll(actor: JwtAccessPayload, params?: TenantListParams) {
    const q = params?.q?.trim();
    const page = params?.page;
    const pageSize = params?.pageSize;
    const paged = page !== undefined || pageSize !== undefined || !!q;
    const pageResolved = Math.max(1, page ?? 1);
    const pageSizeResolved = Math.min(100, Math.max(1, pageSize ?? 20));
    const where = {
      ...(actor.role === UserRole.SUPER_ADMIN
        ? {}
        : { organizationId: actor.organizationId }),
      ...(q
        ? {
            OR: [
              { legalName: { contains: q, mode: 'insensitive' as const } },
              { tradingName: { contains: q, mode: 'insensitive' as const } },
              { contactEmail: { contains: q, mode: 'insensitive' as const } },
              { contactPhone: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    return this.prisma.withUserRls(actor, async (tx) => {
      if (!paged) {
        return tx.tenant.findMany({
          where,
          orderBy: { legalName: 'asc' },
          include: { _count: { select: { leases: true } } },
        });
      }
      const [items, total] = await Promise.all([
        tx.tenant.findMany({
          where,
          orderBy: { legalName: 'asc' },
          include: { _count: { select: { leases: true } } },
          skip: (pageResolved - 1) * pageSizeResolved,
          take: pageSizeResolved,
        }),
        tx.tenant.count({ where }),
      ]);
      return {
        items,
        total,
        page: pageResolved,
        pageSize: pageSizeResolved,
      };
    });
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
    return this.prisma.withUserRls(actor, async (tx) => {
      const created = await tx.tenant.create({
        data: {
          organizationId,
          legalName: dto.legalName.trim(),
          tradingName: dto.tradingName?.trim(),
          contactEmail: dto.contactEmail?.trim().toLowerCase(),
          contactPhone: dto.contactPhone?.trim(),
        },
        include: { _count: { select: { leases: true } } },
      });
      if (created.contactEmail) {
        try {
          await this.ensureTenantUserForTenant(
            tx,
            organizationId,
            created.contactEmail,
            created.tradingName,
            created.legalName,
          );
        } catch (e) {
          throw new ConflictException(
            e instanceof Error
              ? e.message
              : 'Could not auto-create linked tenant user',
          );
        }
      }
      return created;
    });
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
      const updated = await tx.tenant.update({
        where: { id },
        data: {
          ...(dto.legalName !== undefined && {
            legalName: dto.legalName.trim(),
          }),
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
      if (updated.contactEmail) {
        await this.ensureTenantUserForTenant(
          tx,
          updated.organizationId,
          updated.contactEmail,
          updated.tradingName,
          updated.legalName,
        );
      }
      return updated;
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
