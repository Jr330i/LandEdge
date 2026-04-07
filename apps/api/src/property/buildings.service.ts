import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtAccessPayload } from '../auth/jwt.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBuildingDto } from './dto/create-building.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';

@Injectable()
export class BuildingsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(portfolioId: string, actor: JwtAccessPayload) {
    return this.prisma.withUserRls(actor, (tx) =>
      tx.building.findMany({
        where: { portfolioId },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: { _count: { select: { floors: true } } },
      }),
    );
  }

  findOne(id: string, actor: JwtAccessPayload) {
    return this.prisma.withUserRls(actor, async (tx) => {
      const row = await tx.building.findUnique({
        where: { id },
        include: { _count: { select: { floors: true } } },
      });
      if (!row) {
        throw new NotFoundException('Building not found');
      }
      return row;
    });
  }

  create(actor: JwtAccessPayload, dto: CreateBuildingDto) {
    return this.prisma.withUserRls(actor, async (tx) => {
      const agg = await tx.building.aggregate({
        where: { portfolioId: dto.portfolioId },
        _max: { sortOrder: true },
      });
      const nextOrder = (agg._max.sortOrder ?? -1) + 1;
      return tx.building.create({
        data: {
          portfolioId: dto.portfolioId,
          name: dto.name.trim(),
          address: dto.address?.trim(),
          latitude: dto.latitude,
          longitude: dto.longitude,
          sortOrder: nextOrder,
        },
        include: { _count: { select: { floors: true } } },
      });
    });
  }

  reorder(portfolioId: string, orderedIds: string[], actor: JwtAccessPayload) {
    return this.prisma.withUserRls(actor, async (tx) => {
      const rows = await tx.building.findMany({
        where: { portfolioId },
        select: { id: true },
      });
      const expected = new Set(rows.map((r) => r.id));
      if (orderedIds.length !== expected.size) {
        throw new BadRequestException(
          'buildingIds must list each building in the portfolio exactly once',
        );
      }
      for (const id of orderedIds) {
        if (!expected.has(id)) {
          throw new BadRequestException(
            'buildingIds must belong to the selected portfolio',
          );
        }
      }
      await Promise.all(
        orderedIds.map((id, i) =>
          tx.building.update({ where: { id }, data: { sortOrder: i } }),
        ),
      );
      return { ok: true as const };
    });
  }

  update(id: string, actor: JwtAccessPayload, dto: UpdateBuildingDto) {
    return this.prisma.withUserRls(actor, async (tx) => {
      const existing = await tx.building.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException('Building not found');
      }
      return tx.building.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(dto.address !== undefined && {
            address: dto.address?.trim() ?? null,
          }),
          ...(dto.latitude !== undefined && { latitude: dto.latitude }),
          ...(dto.longitude !== undefined && { longitude: dto.longitude }),
        },
        include: { _count: { select: { floors: true } } },
      });
    });
  }

  remove(id: string, actor: JwtAccessPayload) {
    return this.prisma.withUserRls(actor, async (tx) => {
      const existing = await tx.building.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException('Building not found');
      }
      await tx.building.delete({ where: { id } });
      return { id, deleted: true };
    });
  }
}
