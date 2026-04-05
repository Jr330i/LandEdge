import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import type { JwtAccessPayload } from '../auth/jwt.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { UpdatePortfolioDto } from './dto/update-portfolio.dto';

@Injectable()
export class PortfoliosService {
  constructor(private readonly prisma: PrismaService) {}

  private resolveOrganizationId(
    actor: JwtAccessPayload,
    dto: CreatePortfolioDto | UpdatePortfolioDto,
  ): string {
    if (dto.organizationId) {
      if (actor.role !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenException('organizationId is restricted to SUPER_ADMIN');
      }
      return dto.organizationId;
    }
    return actor.organizationId;
  }

  findAll(actor: JwtAccessPayload) {
    return this.prisma.withUserRls(actor, (tx) =>
      tx.portfolio.findMany({
        where:
          actor.role === UserRole.SUPER_ADMIN
            ? {}
            : { organizationId: actor.organizationId },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { buildings: true } } },
      }),
    );
  }

  findOne(id: string, actor: JwtAccessPayload) {
    return this.prisma.withUserRls(actor, async (tx) => {
      const row = await tx.portfolio.findUnique({
        where: { id },
        include: { _count: { select: { buildings: true } } },
      });
      if (!row) {
        throw new NotFoundException('Portfolio not found');
      }
      return row;
    });
  }

  create(actor: JwtAccessPayload, dto: CreatePortfolioDto) {
    const organizationId = this.resolveOrganizationId(actor, dto);
    return this.prisma.withUserRls(actor, (tx) =>
      tx.portfolio.create({
        data: {
          organizationId,
          name: dto.name.trim(),
          region: dto.region?.trim() || undefined,
        },
        include: { _count: { select: { buildings: true } } },
      }),
    );
  }

  update(id: string, actor: JwtAccessPayload, dto: UpdatePortfolioDto) {
    return this.prisma.withUserRls(actor, async (tx) => {
      await this.ensurePortfolio(tx, id, actor);
      const organizationId = dto.organizationId
        ? this.resolveOrganizationId(actor, dto)
        : undefined;
      return tx.portfolio.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(dto.region !== undefined && {
            region: dto.region?.trim() || null,
          }),
          ...(organizationId !== undefined && { organizationId }),
        },
        include: { _count: { select: { buildings: true } } },
      });
    });
  }

  remove(id: string, actor: JwtAccessPayload) {
    return this.prisma.withUserRls(actor, async (tx) => {
      await this.ensurePortfolio(tx, id, actor);
      await tx.portfolio.delete({ where: { id } });
      return { id, deleted: true };
    });
  }

  private async ensurePortfolio(
    tx: Prisma.TransactionClient,
    id: string,
    actor: JwtAccessPayload,
  ) {
    const row = await tx.portfolio.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Portfolio not found');
    }
    if (
      actor.role !== UserRole.SUPER_ADMIN &&
      row.organizationId !== actor.organizationId
    ) {
      throw new NotFoundException('Portfolio not found');
    }
  }
}
