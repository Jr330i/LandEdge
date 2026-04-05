import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { JwtAccessPayload } from '../auth/jwt.types';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from './organizations.service';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  const orgApi = {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  };
  const txLike = { organization: orgApi };
  const prismaMock = {
    organization: orgApi,
    withUserRls: jest.fn(
      (_u: JwtAccessPayload, fn: (tx: typeof txLike) => Promise<unknown>) =>
        fn(txLike),
    ),
  };

  const superActor: JwtAccessPayload = {
    sub: '00000000-0000-4000-8000-000000000099',
    email: 'super@test',
    organizationId: '00000000-0000-4000-8000-000000000001',
    role: UserRole.SUPER_ADMIN,
    typ: 'access',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(OrganizationsService);
  });

  it('create uses slug from dto when provided', async () => {
    orgApi.create.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Acme',
      slug: 'acme',
      timezone: 'Africa/Johannesburg',
      baseCurrency: 'ZAR',
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await service.create(
      {
        name: 'Acme',
        slug: 'acme',
      },
      superActor,
    );

    expect(orgApi.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Acme',
        slug: 'acme',
      }),
    });
  });

  it('create slugifies name when slug omitted', async () => {
    orgApi.create.mockResolvedValue({});

    await service.create({ name: 'Hello   World' }, superActor);

    expect(orgApi.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        slug: 'hello-world',
      }),
    });
  });

  it('create throws when slug cannot be derived', async () => {
    await expect(
      service.create({ name: '!!!' }, superActor),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(orgApi.create).not.toHaveBeenCalled();
  });

  it('findAllForUser returns all orgs for SUPER_ADMIN', async () => {
    orgApi.findMany.mockResolvedValue([{ id: 'a' }]);
    const user: JwtAccessPayload = {
      sub: 'u1',
      email: 's@test',
      organizationId: '00000000-0000-4000-8000-000000000001',
      role: UserRole.SUPER_ADMIN,
      typ: 'access',
    };
    await service.findAllForUser(user);
    const arg = orgApi.findMany.mock.calls[0][0];
    expect(arg.where).toBeUndefined();
  });

  it('findAllForUser scopes to organization for ORG_ADMIN', async () => {
    orgApi.findMany.mockResolvedValue([]);
    const orgId = '00000000-0000-4000-8000-0000000000aa';
    const user: JwtAccessPayload = {
      sub: 'u1',
      email: 'a@test',
      organizationId: orgId,
      role: UserRole.ORG_ADMIN,
      typ: 'access',
    };
    await service.findAllForUser(user);
    expect(orgApi.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: orgId },
      }),
    );
  });
});
