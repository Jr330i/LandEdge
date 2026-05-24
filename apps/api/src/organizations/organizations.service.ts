import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth/auth.service';
import type { JwtAccessPayload } from '../auth/jwt.types';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { CreateOrganizationUserDto } from './dto/create-organization-user.dto';
import { UpdateOrganizationInvoiceProfileDto } from './dto/update-organization-invoice-profile.dto';
import { UpdateOrganizationUserDto } from './dto/update-organization-user.dto';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly mail: MailService,
  ) {}

  private assertCanManageRole(actorRole: UserRole, targetRole: UserRole) {
    if (actorRole === UserRole.SUPER_ADMIN) {
      return;
    }
    if (actorRole === UserRole.ORG_ADMIN) {
      if (
        targetRole === UserRole.SUPER_ADMIN ||
        targetRole === UserRole.ORG_ADMIN
      ) {
        throw new ForbiddenException(
          'You can only manage roles below ORG_ADMIN',
        );
      }
      return;
    }
    throw new ForbiddenException('Insufficient role to manage users');
  }

  private assertOrgScope(actor: JwtAccessPayload, organizationId: string) {
    if (
      actor.role !== UserRole.SUPER_ADMIN &&
      actor.organizationId !== organizationId
    ) {
      throw new NotFoundException('Organization not found');
    }
  }

  private async ensureTenantForTenantUser(
    tx: Prisma.TransactionClient,
    organizationId: string,
    email: string,
    displayName?: string | null,
  ) {
    const normalizedEmail = email.trim().toLowerCase();
    const existingTenant = await tx.tenant.findFirst({
      where: {
        organizationId,
        contactEmail: { equals: normalizedEmail, mode: 'insensitive' },
      },
    });
    if (existingTenant) return existingTenant;
    const baseName =
      displayName?.trim() ||
      normalizedEmail.split('@')[0].replace(/[._-]+/g, ' ') ||
      'Tenant';
    const legalName = `${baseName} Tenant`;
    return tx.tenant.create({
      data: {
        organizationId,
        legalName,
        tradingName: baseName,
        contactEmail: normalizedEmail,
      },
    });
  }

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
    return this.prisma.withUserRls(user, async (tx) => this.findOneTx(tx, id));
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
        org.settings &&
        typeof org.settings === 'object' &&
        !Array.isArray(org.settings)
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
        address: dto.invoiceAddress?.trim() || null,
        phone: dto.invoicePhone?.trim() || null,
        email: dto.invoiceEmail?.trim() || null,
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

  async listUsers(organizationId: string, actor: JwtAccessPayload) {
    this.assertOrgScope(actor, organizationId);
    return this.prisma.withUserRls(actor, async (tx) => {
      const org = await tx.organization.findUnique({
        where: { id: organizationId },
      });
      if (!org) throw new NotFoundException('Organization not found');
      const rows = await tx.user.findMany({
        where: { organizationId },
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          passwordHash: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ role: 'asc' }, { email: 'asc' }],
      });
      return rows.map((r) => ({
        id: r.id,
        email: r.email,
        displayName: r.displayName,
        role: r.role,
        hasPassword: !!r.passwordHash,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));
    });
  }

  async createUser(
    organizationId: string,
    dto: CreateOrganizationUserDto,
    actor: JwtAccessPayload,
  ) {
    this.assertOrgScope(actor, organizationId);
    this.assertCanManageRole(actor.role, dto.role);

    const result = await this.prisma.withUserRls(actor, async (tx) => {
      const org = await tx.organization.findUnique({
        where: { id: organizationId },
      });
      if (!org) throw new NotFoundException('Organization not found');
      const passwordHash = dto.password
        ? await bcrypt.hash(dto.password, 10)
        : null;
      try {
        const created = await tx.user.create({
          data: {
            organizationId,
            email: dto.email.trim().toLowerCase(),
            displayName: dto.displayName?.trim() || null,
            role: dto.role,
            passwordHash,
          },
          select: {
            id: true,
            email: true,
            displayName: true,
            role: true,
            passwordHash: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        if (created.role === UserRole.TENANT_USER) {
          await this.ensureTenantForTenantUser(
            tx,
            organizationId,
            created.email,
            created.displayName,
          );
        }
        return {
          user: created,
          org,
        };
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          throw new ConflictException(
            'Email already exists in this organization',
          );
        }
        throw e;
      }
    });

    let inviteEmailSent = false;
    if (!dto.password || dto.sendInviteEmail) {
      inviteEmailSent = await this.authService.sendInviteEmail({
        userId: result.user.id,
        email: result.user.email,
        displayName: result.user.displayName,
        organizationId: result.org.id,
        organizationName: result.org.name,
        organizationSlug: result.org.slug,
      });
    }

    return {
      id: result.user.id,
      email: result.user.email,
      displayName: result.user.displayName,
      role: result.user.role,
      hasPassword: !!result.user.passwordHash,
      createdAt: result.user.createdAt,
      updatedAt: result.user.updatedAt,
      inviteEmailSent,
      inviteEmailConfigured: this.mail.isConfigured(),
    };
  }

  async sendUserInvite(
    organizationId: string,
    userId: string,
    actor: JwtAccessPayload,
  ) {
    this.assertOrgScope(actor, organizationId);
    const row = await this.prisma.withUserRls(actor, async (tx) => {
      const org = await tx.organization.findUnique({
        where: { id: organizationId },
      });
      if (!org) throw new NotFoundException('Organization not found');
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user || user.organizationId !== organizationId) {
        throw new NotFoundException('User not found');
      }
      this.assertCanManageRole(actor.role, user.role);
      return { org, user };
    });

    const inviteEmailSent = await this.authService.sendInviteEmail({
      userId: row.user.id,
      email: row.user.email,
      displayName: row.user.displayName,
      organizationId: row.org.id,
      organizationName: row.org.name,
      organizationSlug: row.org.slug,
    });

    return {
      ok: true,
      inviteEmailSent,
      inviteEmailConfigured: this.mail.isConfigured(),
    };
  }

  async updateUser(
    organizationId: string,
    userId: string,
    dto: UpdateOrganizationUserDto,
    actor: JwtAccessPayload,
  ) {
    this.assertOrgScope(actor, organizationId);
    return this.prisma.withUserRls(actor, async (tx) => {
      const existing = await tx.user.findUnique({ where: { id: userId } });
      if (!existing || existing.organizationId !== organizationId) {
        throw new NotFoundException('User not found');
      }
      this.assertCanManageRole(actor.role, existing.role);
      if (dto.role) {
        this.assertCanManageRole(actor.role, dto.role);
      }
      if (existing.id === actor.sub && dto.role && dto.role !== existing.role) {
        throw new BadRequestException('You cannot change your own role');
      }
      const data: Prisma.UserUpdateInput = {
        ...(dto.email !== undefined && {
          email: dto.email.trim().toLowerCase(),
        }),
        ...(dto.displayName !== undefined && {
          displayName: dto.displayName?.trim() || null,
        }),
        ...(dto.role !== undefined && { role: dto.role }),
      };
      if (dto.password !== undefined) {
        data.passwordHash = await bcrypt.hash(dto.password, 10);
      }
      try {
        const updated = await tx.user.update({
          where: { id: userId },
          data,
          select: {
            id: true,
            email: true,
            displayName: true,
            role: true,
            passwordHash: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        if (updated.role === UserRole.TENANT_USER) {
          await this.ensureTenantForTenantUser(
            tx,
            organizationId,
            updated.email,
            updated.displayName,
          );
        }
        return {
          id: updated.id,
          email: updated.email,
          displayName: updated.displayName,
          role: updated.role,
          hasPassword: !!updated.passwordHash,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        };
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          throw new ConflictException(
            'Email already exists in this organization',
          );
        }
        throw e;
      }
    });
  }

  async removeUser(
    organizationId: string,
    userId: string,
    actor: JwtAccessPayload,
  ) {
    this.assertOrgScope(actor, organizationId);
    return this.prisma.withUserRls(actor, async (tx) => {
      const existing = await tx.user.findUnique({ where: { id: userId } });
      if (!existing || existing.organizationId !== organizationId) {
        throw new NotFoundException('User not found');
      }
      this.assertCanManageRole(actor.role, existing.role);
      if (existing.id === actor.sub) {
        throw new BadRequestException('You cannot delete your own account');
      }
      await tx.user.delete({ where: { id: userId } });
      return { id: userId, deleted: true };
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
