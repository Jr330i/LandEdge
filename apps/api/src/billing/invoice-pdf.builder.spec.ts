import {
  assertValidPdfBuffer,
  renderInvoicePdf,
  taxInvoiceNumber,
  ZM_VAT_RATE,
} from './invoice-pdf.builder';
import { InvoiceStatus } from '@prisma/client';
import type { InvoicePdfRow } from './invoice-pdf.builder';

describe('invoice-pdf.builder', () => {
  const baseRow: InvoicePdfRow = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    organizationId: 'org-id',
    leaseId: 'lease-id',
    tenantId: 'tenant-id',
    status: InvoiceStatus.ISSUED,
    periodStart: new Date('2026-05-01'),
    periodEnd: new Date('2026-05-31'),
    dueDate: new Date('2026-06-07'),
    currency: 'ZMW',
    notes: 'May 2026 rent',
    createdAt: new Date('2026-05-09T10:00:00.000Z'),
    updatedAt: new Date('2026-05-09T10:00:00.000Z'),
    lines: [
      {
        id: 'line-1',
        invoiceId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        description: 'Rent — Unit A1',
        amount: 1160 as never,
        chargeScheduleId: null,
        createdAt: new Date('2026-05-09T10:00:00.000Z'),
      },
    ],
    tenant: {
      legalName: 'Acme Trading Ltd',
      tradingName: 'Acme',
      contactEmail: 'billing@acme.co.zm',
      contactPhone: '+260971234567',
    },
    organization: {
      name: 'Demo Property Co',
      slug: 'demo',
      settings: {
        invoiceProfile: {
          legalName: 'Demo Property Co Ltd',
          taxNumber: '1001234567',
          address: 'Plot 1, Cairo Road, Lusaka',
          phone: '+260211123456',
          email: 'accounts@demo.co.zm',
          bankDetails: 'ZANACO · 1234567890 · Lusaka Main',
          paymentInstructions: 'Pay within 7 days.',
        },
      },
    },
  };

  it('renders a valid PDF buffer with %PDF header', async () => {
    const buffer = await renderInvoicePdf(baseRow);
    assertValidPdfBuffer(buffer);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('builds a stable tax invoice number from org slug and date', () => {
    expect(taxInvoiceNumber(baseRow)).toBe('DEMO/20260509/A1B2C3D4');
  });

  it('uses Zambia VAT rate constant of 16%', () => {
    expect(ZM_VAT_RATE).toBe(0.16);
  });
});
