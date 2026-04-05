import { Injectable, NotFoundException } from '@nestjs/common';
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
        orderBy: [{ level: 'asc' }, { name: 'asc' }],
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
    return this.prisma.withUserRls(actor, (tx) =>
      tx.floor.create({
        data: {
          buildingId: dto.buildingId,
          name: dto.name.trim(),
          level: dto.level,
        },
        include: { _count: { select: { units: true } } },
      }),
    );
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
