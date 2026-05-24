import {
  InvoiceStatus,
  LedgerSource,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { setSeedRlsSession } from '../src/prisma/rls-session';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('demo123', 10);

  await prisma.$transaction(async (tx) => {
    await setSeedRlsSession(tx);

    const org = await tx.organization.upsert({
      where: { slug: 'demo' },
      create: {
        name: 'Demo Property Co',
        slug: 'demo',
        timezone: 'Africa/Johannesburg',
        baseCurrency: 'ZAR',
      },
      update: {},
    });

    await tx.user.upsert({
      where: {
        organizationId_email: {
          organizationId: org.id,
          email: 'admin@demo.sofinda.local',
        },
      },
      create: {
        organizationId: org.id,
        email: 'admin@demo.sofinda.local',
        passwordHash,
        displayName: 'Demo Org Admin',
        role: 'ORG_ADMIN',
      },
      update: { passwordHash },
    });

    await tx.user.upsert({
      where: {
        organizationId_email: {
          organizationId: org.id,
          email: 'super@demo.sofinda.local',
        },
      },
      create: {
        organizationId: org.id,
        email: 'super@demo.sofinda.local',
        passwordHash,
        displayName: 'Platform Super Admin',
        role: 'SUPER_ADMIN',
      },
      update: { passwordHash },
    });

    await tx.user.upsert({
      where: {
        organizationId_email: {
          organizationId: org.id,
          email: 'tenant@demo.sofinda.local',
        },
      },
      create: {
        organizationId: org.id,
        email: 'tenant@demo.sofinda.local',
        passwordHash,
        displayName: 'Demo Tenant User',
        role: 'TENANT_USER',
      },
      update: { passwordHash },
    });

    await tx.user.upsert({
      where: {
        organizationId_email: {
          organizationId: org.id,
          email: 'owner@demo.sofinda.local',
        },
      },
      create: {
        organizationId: org.id,
        email: 'owner@demo.sofinda.local',
        passwordHash,
        displayName: 'Demo Property Owner',
        role: 'OWNER_USER',
      },
      update: { passwordHash },
    });

    let portfolio = await tx.portfolio.findFirst({
      where: { organizationId: org.id, name: 'Demo Portfolio' },
    });
    if (!portfolio) {
      portfolio = await tx.portfolio.create({
        data: {
          organizationId: org.id,
          name: 'Demo Portfolio',
          region: 'ZA',
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
            create: [
              { unitId: demoUnit.id, percentageAllocated: 100 },
            ],
          },
        },
      });
    }

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
          currency: 'ZAR',
          frequency: 'MONTHLY',
          startDate: new Date('2025-01-01'),
          active: true,
        },
      });
    }

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
          currency: 'ZAR',
          notes: 'Demo draft — issue from admin UI or POST /billing/invoices/:id/issue',
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
          currency: 'ZAR',
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
          narrative: `Invoice ${issuedInv.id.slice(0, 8)}… (2026-02-01–2026-02-28)`,
          signedAmount: total,
          currency: 'ZAR',
          source: LedgerSource.INVOICE,
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
          currency: 'ZAR',
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
  .then(() => {
    console.info('Seed completed.');
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
