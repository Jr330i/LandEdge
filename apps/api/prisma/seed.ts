import {
  InvoiceStatus,
  LedgerSource,
  Prisma,
  PrismaClient,
  type Organization,
  type Building,
  type ChargeSchedule,
  type Floor,
  type Lease,
  type Portfolio,
  type Tenant,
  type Unit,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { setSeedRlsSession } from '../src/prisma/rls-session';
import { DEFAULT_CURRENCY, DEFAULT_TIMEZONE } from '../src/defaults';
import {
  buildInvoiceLedgerNarrative,
  isLegacyInvoiceLedgerNarrative,
} from '../src/billing/ledger-narrative.util';

const prisma = new PrismaClient();

/** Short transactions — Neon pooler (-pooler host) cannot hold one long interactive tx. */
async function withSeedRls<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await setSeedRlsSession(tx);
      return fn(tx);
    },
    { maxWait: 10_000, timeout: 60_000 },
  );
}

async function main() {
  const passwordHash = await bcrypt.hash('demo123', 10);

  const org = await withSeedRls(async (tx) =>
    tx.organization.upsert({
      where: { slug: 'demo' },
      create: {
        name: 'Demo Property Co',
        slug: 'demo',
        timezone: DEFAULT_TIMEZONE,
        baseCurrency: DEFAULT_CURRENCY,
      },
      update: {},
    }),
  );

  await seedUsers(org, passwordHash);

  const { portfolio, building, floor, demoUnit } = await seedProperty(org);
  const { tenant, lease } = await seedTenantAndLease(org, demoUnit);
  const rentSchedule = await seedChargeSchedule(org, lease);
  await seedInvoicesAndLedger(org, lease, tenant, rentSchedule, demoUnit);

  console.info('Seed completed.');
}

async function seedUsers(org: Organization, passwordHash: string) {
  const users = [
    {
      email: 'admin@demo.sofinda.local',
      displayName: 'Demo Org Admin',
      role: 'ORG_ADMIN' as const,
    },
    {
      email: 'super@demo.sofinda.local',
      displayName: 'Platform Super Admin',
      role: 'SUPER_ADMIN' as const,
    },
    {
      email: 'tenant@demo.sofinda.local',
      displayName: 'Demo Tenant User',
      role: 'TENANT_USER' as const,
    },
    {
      email: 'owner@demo.sofinda.local',
      displayName: 'Demo Property Owner',
      role: 'OWNER_USER' as const,
    },
  ];

  for (const user of users) {
    await withSeedRls(async (tx) =>
      tx.user.upsert({
        where: {
          organizationId_email: {
            organizationId: org.id,
            email: user.email,
          },
        },
        create: {
          organizationId: org.id,
          email: user.email,
          passwordHash,
          displayName: user.displayName,
          role: user.role,
        },
        update: { passwordHash },
      }),
    );
  }
}

async function seedProperty(org: Organization): Promise<{
  portfolio: Portfolio;
  building: Building;
  floor: Floor;
  demoUnit: Unit;
}> {
  return withSeedRls(async (tx) => {
    let portfolio = await tx.portfolio.findFirst({
      where: { organizationId: org.id, name: 'Demo Portfolio' },
    });
    if (!portfolio) {
      portfolio = await tx.portfolio.create({
        data: {
          organizationId: org.id,
          name: 'Demo Portfolio',
          region: 'ZM',
        },
      });
    }

    let building = await tx.building.findFirst({
      where: { portfolioId: portfolio.id, name: 'Demo Tower' },
    });
    if (!building) {
      building = await tx.building.create({
        data: {
          portfolioId: portfolio.id,
          name: 'Demo Tower',
          address: '1 Demo Way',
        },
      });
    }

    let floor = await tx.floor.findFirst({
      where: { buildingId: building.id, name: 'Level 1' },
    });
    if (!floor) {
      floor = await tx.floor.create({
        data: {
          buildingId: building.id,
          name: 'Level 1',
          level: 1,
        },
      });
    }

    const demoUnit = await tx.unit.upsert({
      where: {
        floorId_code: { floorId: floor.id, code: 'L1-101' },
      },
      create: {
        floorId: floor.id,
        code: 'L1-101',
        type: 'retail',
        rentableArea: 120,
        status: 'VACANT',
      },
      update: {},
    });

    return { portfolio, building, floor, demoUnit };
  });
}

async function seedTenantAndLease(
  org: Organization,
  demoUnit: Unit,
): Promise<{ tenant: Tenant; lease: Lease }> {
  return withSeedRls(async (tx) => {
    let tenant = await tx.tenant.findFirst({
      where: {
        organizationId: org.id,
        legalName: 'Demo Retail Tenant (Pty) Ltd',
      },
    });
    if (!tenant) {
      tenant = await tx.tenant.create({
        data: {
          organizationId: org.id,
          legalName: 'Demo Retail Tenant (Pty) Ltd',
          tradingName: 'Demo Shop',
          contactEmail: 'tenant@demo.sofinda.local',
        },
      });
    }

    let lease = await tx.lease.findFirst({
      where: { tenantId: tenant.id, organizationId: org.id },
    });
    if (!lease) {
      lease = await tx.lease.create({
        data: {
          organizationId: org.id,
          tenantId: tenant.id,
          startDate: new Date('2025-01-01'),
          endDate: new Date('2028-12-31'),
          status: 'ACTIVE',
          terms: {},
          leaseUnits: {
            create: [{ unitId: demoUnit.id, percentageAllocated: 100 }],
          },
        },
      });
    }

    return { tenant, lease };
  });
}

async function seedChargeSchedule(
  org: Organization,
  lease: Lease,
): Promise<ChargeSchedule> {
  return withSeedRls(async (tx) => {
    let rentSchedule = await tx.chargeSchedule.findFirst({
      where: { leaseId: lease.id, kind: 'RENT' },
    });
    if (!rentSchedule) {
      rentSchedule = await tx.chargeSchedule.create({
        data: {
          organizationId: org.id,
          leaseId: lease.id,
          kind: 'RENT',
          label: 'Base rent (demo)',
          amount: new Prisma.Decimal('15000.00'),
          currency: DEFAULT_CURRENCY,
          frequency: 'MONTHLY',
          startDate: new Date('2025-01-01'),
          active: true,
        },
      });
    }
    return rentSchedule;
  });
}

async function seedInvoicesAndLedger(
  org: Organization,
  lease: Lease,
  tenant: Tenant,
  rentSchedule: ChargeSchedule,
  demoUnit: Unit,
) {
  await withSeedRls(async (tx) => {
    const draftInv = await tx.invoice.findFirst({
      where: {
        leaseId: lease.id,
        status: InvoiceStatus.DRAFT,
        periodStart: new Date('2026-03-01'),
      },
    });
    if (!draftInv) {
      await tx.invoice.create({
        data: {
          organizationId: org.id,
          leaseId: lease.id,
          tenantId: tenant.id,
          status: InvoiceStatus.DRAFT,
          periodStart: new Date('2026-03-01'),
          periodEnd: new Date('2026-03-31'),
          dueDate: new Date('2026-04-07'),
          currency: DEFAULT_CURRENCY,
          notes:
            'Demo draft — issue from admin UI or POST /billing/invoices/:id/issue',
          lines: {
            create: [
              {
                description: 'Rent — March (demo)',
                amount: new Prisma.Decimal('15000.00'),
                chargeScheduleId: rentSchedule.id,
              },
            ],
          },
        },
      });
    }

    let issuedInv = await tx.invoice.findFirst({
      where: {
        leaseId: lease.id,
        status: InvoiceStatus.ISSUED,
        periodStart: new Date('2026-02-01'),
      },
      include: { ledgerEntry: true, lines: true },
    });
    if (!issuedInv) {
      issuedInv = await tx.invoice.create({
        data: {
          organizationId: org.id,
          leaseId: lease.id,
          tenantId: tenant.id,
          status: InvoiceStatus.ISSUED,
          periodStart: new Date('2026-02-01'),
          periodEnd: new Date('2026-02-28'),
          dueDate: new Date('2026-03-07'),
          currency: DEFAULT_CURRENCY,
          notes: 'Demo issued invoice — visible in tenant portal',
          lines: {
            create: [
              {
                description: 'Rent — February (demo)',
                amount: new Prisma.Decimal('15000.00'),
                chargeScheduleId: rentSchedule.id,
              },
            ],
          },
        },
        include: { ledgerEntry: true, lines: true },
      });
    }
    if (!issuedInv.ledgerEntry) {
      const total = issuedInv.lines.reduce(
        (acc, l) => acc.add(l.amount),
        new Prisma.Decimal(0),
      );
      await tx.ledgerEntry.create({
        data: {
          organizationId: org.id,
          leaseId: lease.id,
          tenantId: tenant.id,
          invoiceId: issuedInv.id,
          narrative: buildInvoiceLedgerNarrative(
            issuedInv.lines,
            issuedInv.periodStart,
            issuedInv.periodEnd,
          ),
          signedAmount: total,
          currency: DEFAULT_CURRENCY,
          source: LedgerSource.INVOICE,
        },
      });
    } else if (
      isLegacyInvoiceLedgerNarrative(
        issuedInv.ledgerEntry.narrative,
        issuedInv.id,
      )
    ) {
      await tx.ledgerEntry.update({
        where: { id: issuedInv.ledgerEntry.id },
        data: {
          narrative: buildInvoiceLedgerNarrative(
            issuedInv.lines,
            issuedInv.periodStart,
            issuedInv.periodEnd,
          ),
        },
      });
    }

    const paymentExists = await tx.ledgerEntry.findFirst({
      where: {
        organizationId: org.id,
        tenantId: tenant.id,
        source: LedgerSource.PAYMENT,
        narrative: { contains: 'Demo partial payment' },
      },
    });
    if (!paymentExists) {
      await tx.ledgerEntry.create({
        data: {
          organizationId: org.id,
          leaseId: lease.id,
          tenantId: tenant.id,
          invoiceId: null,
          narrative: 'Demo partial payment — February rent',
          signedAmount: new Prisma.Decimal('-5000.00'),
          currency: DEFAULT_CURRENCY,
          source: LedgerSource.PAYMENT,
        },
      });
    }

    await tx.unit.update({
      where: { id: demoUnit.id },
      data: { status: 'LEASED' },
    });
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
