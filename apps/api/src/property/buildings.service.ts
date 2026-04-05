import { Injectable, NotFoundException } from '@nestjs/common';
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
        orderBy: { name: 'asc' },
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
    return this.prisma.withUserRls(actor, (tx) =>
      tx.building.create({
        data: {
          portfolioId: dto.portfolioId,
          name: dto.name.trim(),
          address: dto.address?.trim(),
          latitude: dto.latitude,
          longitude: dto.longitude,
        },
        include: { _count: { select: { floors: true } } },
      }),
    );
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
