import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import type { JwtAccessPayload } from '../auth/jwt.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationInvoiceProfileDto } from './dto/update-organization-invoice-profile.dto';

function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOrganizationDto, actor: JwtAccessPayload) {
    const slug = dto.slug?.length ? dto.slug : slugifyName(dto.name);
    if (!slug.length) {
      throw new ConflictException('Could not derive a valid slug from name');
    }

    return this.prisma.withUserRls(actor, async (tx) => {
      try {
        return await tx.organization.create({
          data: {
            name: dto.name.trim(),
            slug,
            timezone: dto.timezone ?? undefined,
            baseCurrency: dto.baseCurrency ?? undefined,
          },
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          throw new ConflictException('Organization slug already exists');
        }
        throw e;
      }
    });
  }

  private readonly orgListSelect = {
    id: true,
    name: true,
    slug: true,
    timezone: true,
    baseCurrency: true,
    settings: true,
    createdAt: true,
    updatedAt: true,
    _count: { select: { users: true } },
  } as const;

  async findAllForUser(user: JwtAccessPayload) {
    return this.prisma.withUserRls(user, async (tx) => {
      if (user.role === UserRole.SUPER_ADMIN) {
        return tx.organization.findMany({
          orderBy: { createdAt: 'desc' },
          select: this.orgListSelect,
        });
      }
      return tx.organization.findMany({
        where: { id: user.organizationId },
        orderBy: { createdAt: 'desc' },
        select: this.orgListSelect,
      });
    });
  }

  async findOneForUser(id: string, user: JwtAccessPayload) {
    if (user.role !== UserRole.SUPER_ADMIN && id !== user.organizationId) {
      throw new NotFoundException('Organization not found');
    }
    return this.prisma.withUserRls(user, async (tx) =>
      this.findOneTx(tx, id),
    );
  }

  async updateInvoiceProfile(
    id: string,
    dto: UpdateOrganizationInvoiceProfileDto,
    user: JwtAccessPayload,
  ) {
    if (user.role !== UserRole.SUPER_ADMIN && id !== user.organizationId) {
      throw new NotFoundException('Organization not found');
    }
    return this.prisma.withUserRls(user, async (tx) => {
      const org = await tx.organization.findUnique({ where: { id } });
      if (!org) throw new NotFoundException('Organization not found');
      const settings =
        org.settings && typeof org.settings === 'object' && !Array.isArray(org.settings)
          ? (org.settings as Record<string, unknown>)
          : {};
      const invoiceProfileRaw =
        settings.invoiceProfile &&
        typeof settings.invoiceProfile === 'object' &&
        !Array.isArray(settings.invoiceProfile)
          ? (settings.invoiceProfile as Record<string, unknown>)
          : {};
      const nextInvoiceProfile: Record<string, string | null> = {
        ...invoiceProfileRaw,
        legalName: dto.invoiceLegalName?.trim() || null,
        taxNumber: dto.invoiceTaxNumber?.trim() || null,
        bankDetails: dto.invoiceBankDetails?.trim() || null,
        paymentInstructions: dto.invoicePaymentInstructions?.trim() || null,
        logoUrl: dto.invoiceLogoUrl?.trim() || null,
      };
      return tx.organization.update({
        where: { id },
        data: {
          settings: {
            ...settings,
            invoiceProfile: nextInvoiceProfile,
          },
        },
      });
    });
  }

  private async findOneTx(tx: Prisma.TransactionClient, id: string) {
    const org = await tx.organization.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true } },
      },
    });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return org;
  }
}
