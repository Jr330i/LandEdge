import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtAccessPayload } from '../auth/jwt.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFloorDto } from './dto/create-floor.dto';
import { UpdateFloorDto } from './dto/update-floor.dto';

@Injectable()
export class FloorsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(buildingId: string, actor: JwtAccessPayload) {
    return this.prisma.withUserRls(actor, (tx) =>
      tx.floor.findMany({
        where: { buildingId },
        orderBy: [{ sortOrder: 'asc' }, { level: 'asc' }, { name: 'asc' }],
        include: { _count: { select: { units: true } } },
      }),
    );
  }

  findOne(id: string, actor: JwtAccessPayload) {
    return this.prisma.withUserRls(actor, async (tx) => {
      const row = await tx.floor.findUnique({
        where: { id },
        include: { _count: { select: { units: true } } },
      });
      if (!row) {
        throw new NotFoundException('Floor not found');
      }
      return row;
    });
  }

  create(actor: JwtAccessPayload, dto: CreateFloorDto) {
    return this.prisma.withUserRls(actor, async (tx) => {
      const agg = await tx.floor.aggregate({
        where: { buildingId: dto.buildingId },
        _max: { sortOrder: true },
      });
      const nextOrder = (agg._max.sortOrder ?? -1) + 1;
      return tx.floor.create({
        data: {
          buildingId: dto.buildingId,
          name: dto.name.trim(),
          level: dto.level,
          sortOrder: nextOrder,
        },
        include: { _count: { select: { units: true } } },
      });
    });
  }

  reorder(buildingId: string, orderedIds: string[], actor: JwtAccessPayload) {
    return this.prisma.withUserRls(actor, async (tx) => {
      const rows = await tx.floor.findMany({
        where: { buildingId },
        select: { id: true },
      });
      const expected = new Set(rows.map((r) => r.id));
      if (orderedIds.length !== expected.size) {
        throw new BadRequestException(
          'floorIds must list each floor on the building exactly once',
        );
      }
      for (const id of orderedIds) {
        if (!expected.has(id)) {
          throw new BadRequestException(
            'floorIds must belong to the selected building',
          );
        }
      }
      await Promise.all(
        orderedIds.map((id, i) =>
          tx.floor.update({ where: { id }, data: { sortOrder: i } }),
        ),
      );
      return { ok: true as const };
    });
  }

  update(id: string, actor: JwtAccessPayload, dto: UpdateFloorDto) {
    return this.prisma.withUserRls(actor, async (tx) => {
      const existing = await tx.floor.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException('Floor not found');
      }
      return tx.floor.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(dto.level !== undefined && { level: dto.level }),
        },
        include: { _count: { select: { units: true } } },
      });
    });
  }

  remove(id: string, actor: JwtAccessPayload) {
    return this.prisma.withUserRls(actor, async (tx) => {
      const existing = await tx.floor.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException('Floor not found');
      }
      await tx.floor.delete({ where: { id } });
      return { id, deleted: true };
    });
  }
}
