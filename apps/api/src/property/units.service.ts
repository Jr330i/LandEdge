import { Injectable, NotFoundException } from '@nestjs/common';
import type { JwtAccessPayload } from '../auth/jwt.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

@Injectable()
export class UnitsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(floorId: string, actor: JwtAccessPayload) {
    return this.prisma.withUserRls(actor, (tx) =>
      tx.unit.findMany({
        where: { floorId },
        orderBy: { code: 'asc' },
        include: {
          floor: { select: { buildingId: true } },
        },
      }),
    );
  }

  findOne(id: string, actor: JwtAccessPayload) {
    return this.prisma.withUserRls(actor, async (tx) => {
      const row = await tx.unit.findUnique({ where: { id } });
      if (!row) {
        throw new NotFoundException('Unit not found');
      }
      return row;
    });
  }

  create(actor: JwtAccessPayload, dto: CreateUnitDto) {
    return this.prisma.withUserRls(actor, (tx) =>
      tx.unit.create({
        data: {
          floorId: dto.floorId,
          code: dto.code.trim(),
          type: dto.type.trim(),
          rentableArea: dto.rentableArea,
          status: dto.status,
        },
      }),
    );
  }

  update(id: string, actor: JwtAccessPayload, dto: UpdateUnitDto) {
    return this.prisma.withUserRls(actor, async (tx) => {
      const existing = await tx.unit.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException('Unit not found');
      }
      return tx.unit.update({
        where: { id },
        data: {
          ...(dto.code !== undefined && { code: dto.code.trim() }),
          ...(dto.type !== undefined && { type: dto.type.trim() }),
          ...(dto.rentableArea !== undefined && {
            rentableArea: dto.rentableArea,
          }),
          ...(dto.status !== undefined && { status: dto.status }),
        },
      });
    });
  }

  remove(id: string, actor: JwtAccessPayload) {
    return this.prisma.withUserRls(actor, async (tx) => {
      const existing = await tx.unit.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException('Unit not found');
      }
      await tx.unit.delete({ where: { id } });
      return { id, deleted: true };
    });
  }
}
