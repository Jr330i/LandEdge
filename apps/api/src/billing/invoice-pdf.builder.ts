import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import type {
  Invoice,
  InvoiceLine,
  Organization,
  Tenant,
} from '@prisma/client';
import PDFDocument from 'pdfkit';

/** Standard VAT rate in Zambia (ZRA). */
export const ZM_VAT_RATE = 0.16;

export type InvoicePdfRow = Invoice & {
  lines: InvoiceLine[];
  tenant: Pick<
    Tenant,
    'legalName' | 'tradingName' | 'contactEmail' | 'contactPhone'
  >;
  organization: Pick<Organization, 'name' | 'slug' | 'settings'>;
};

type InvoiceProfile = {
  legalName?: string | null;
  taxNumber?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  bankDetails?: string | null;
  paymentInstructions?: string | null;
  logoUrl?: string | null;
};

function fmtDateZm(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Africa/Lusaka',
  });
}

function fmtMoney(currency: string, n: number): string {
  const code = currency.trim().toUpperCase() || 'ZMW';
  try {
    return new Intl.NumberFormat('en-ZM', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${code} ${n.toLocaleString('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function taxInvoiceNumber(row: InvoicePdfRow): string {
  const slug = row.organization.slug.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const ymd = row.createdAt.toISOString().slice(0, 10).replace(/-/g, '');
  return `${slug || 'INV'}/${ymd}/${row.id.slice(0, 8).toUpperCase()}`;
}

export function assertValidPdfBuffer(buffer: Buffer): void {
  if (!buffer?.length || buffer.subarray(0, 5).toString() !== '%PDF-') {
    throw new InternalServerErrorException('PDF generation failed');
  }
}

async function loadLogoBuffer(logoUrl?: string | null): Promise<Buffer | null> {
  const u = logoUrl?.trim();
  if (!u) return null;
  try {
    const res = await fetch(u);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('png') && !ct.includes('jpeg') && !ct.includes('jpg')) {
      return null;
    }
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function readInvoiceProfile(settings: unknown): InvoiceProfile {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings))
    return {};
  const root = settings as Record<string, unknown>;
  const raw = root.invoiceProfile;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const p = raw as Record<string, unknown>;
  const str = (k: string) => (typeof p[k] === 'string' ? p[k] : null);
  return {
    legalName: str('legalName'),
    taxNumber: str('taxNumber'),
    address: str('address'),
    phone: str('phone'),
    email: str('email'),
    bankDetails: str('bankDetails'),
    paymentInstructions: str('paymentInstructions'),
    logoUrl: str('logoUrl'),
  };
}

function drawLabelValue(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  label: string,
  value: string,
  width: number,
): number {
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#555555').text(label, x, y, {
    width,
  });
  const nextY = y + 11;
  doc.font('Helvetica').fontSize(9).fillColor('#000000').text(value || '—', x, nextY, {
    width,
  });
  return nextY + doc.heightOfString(value || '—', { width }) + 6;
}

function drawTableHeader(
  doc: InstanceType<typeof PDFDocument>,
  y: number,
  cols: { label: string; x: number; w: number; align?: 'left' | 'right' | 'center' }[],
): number {
  const headerH = 18;
  doc.save();
  doc.rect(48, y, 499, headerH).fill('#1e3a5f');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
  for (const c of cols) {
    doc.text(c.label, c.x + 4, y + 5, {
      width: c.w - 8,
      align: c.align ?? 'left',
    });
  }
  doc.restore();
  doc.fillColor('#000000').font('Helvetica');
  return y + headerH;
}

export function renderInvoicePdf(row: InvoicePdfRow): Promise<Buffer> {
  if (!row.lines.length) {
    throw new BadRequestException('Invoice has no lines — cannot generate PDF');
  }

  return loadLogoBuffer(readInvoiceProfile(row.organization.settings).logoUrl).then(
    (logoBuffer) =>
      new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const doc = new PDFDocument({
          margin: 48,
          size: 'A4',
          info: {
            Title: `Tax Invoice ${taxInvoiceNumber(row)}`,
            Author: row.organization.name,
            Subject: 'Zambian VAT Tax Invoice',
          },
        });
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => {
          const buffer = Buffer.concat(chunks);
          try {
            assertValidPdfBuffer(buffer);
            resolve(buffer);
          } catch (e) {
            reject(e);
          }
        });
        doc.on('error', reject);

        const profile = readInvoiceProfile(row.organization.settings);
        const issuerName = profile.legalName?.trim() || row.organization.name;
        const tenantLabel =
          row.tenant.tradingName?.trim() || row.tenant.legalName;
        const invoiceNo = taxInvoiceNumber(row);
        const pageBottom = 760;

        // Header band
        doc.save();
        doc.rect(48, 40, 499, 56).fill('#f4f7fb');
        doc.restore();

        if (logoBuffer) {
          try {
            doc.image(logoBuffer, 48, 46, { fit: [110, 44] });
          } catch {
            // Skip invalid logo payloads.
          }
        }

        doc.font('Helvetica-Bold').fontSize(16).fillColor('#1e3a5f');
        doc.text('TAX INVOICE', 170, 48, { width: 220 });
        doc.font('Helvetica').fontSize(9).fillColor('#444444');
        doc.text('Issued under the Zambia VAT Act (ZRA requirements)', 170, 68, {
          width: 280,
        });
        doc.fillColor('#000000');

        let metaY = 108;
        const leftCol = 48;
        const rightCol = 320;
        const leftW = 250;
        const rightW = 227;

        metaY = drawLabelValue(doc, leftCol, metaY, 'Supplier', issuerName, leftW);
        if (profile.address?.trim()) {
          metaY = drawLabelValue(
            doc,
            leftCol,
            metaY,
            'Supplier address',
            profile.address.trim(),
            leftW,
          );
        }
        if (profile.taxNumber?.trim()) {
          metaY = drawLabelValue(
            doc,
            leftCol,
            metaY,
            'Supplier TPIN',
            profile.taxNumber.trim(),
            leftW,
          );
        }
        if (profile.phone?.trim() || profile.email?.trim()) {
          const contact = [profile.phone?.trim(), profile.email?.trim()]
            .filter(Boolean)
            .join(' · ');
          metaY = drawLabelValue(doc, leftCol, metaY, 'Supplier contact', contact, leftW);
        }

        let rightY = 108;
        rightY = drawLabelValue(
          doc,
          rightCol,
          rightY,
          'Tax invoice number',
          invoiceNo,
          rightW,
        );
        rightY = drawLabelValue(
          doc,
          rightCol,
          rightY,
          'Invoice date',
          fmtDateZm(row.createdAt),
          rightW,
        );
        rightY = drawLabelValue(
          doc,
          rightCol,
          rightY,
          'Supply period',
          `${fmtDateZm(row.periodStart)} – ${fmtDateZm(row.periodEnd)}`,
          rightW,
        );
        if (row.dueDate) {
          rightY = drawLabelValue(
            doc,
            rightCol,
            rightY,
            'Payment due date',
            fmtDateZm(row.dueDate),
            rightW,
          );
        }
        rightY = drawLabelValue(
          doc,
          rightCol,
          rightY,
          'Status',
          row.status.replace(/_/g, ' '),
          rightW,
        );
        rightY = drawLabelValue(
          doc,
          rightCol,
          rightY,
          'Currency',
          row.currency,
          rightW,
        );

        const customerY = Math.max(metaY, rightY) + 8;
        doc.save();
        doc.rect(48, customerY, 499, 52).stroke('#cbd5e1');
        doc.restore();
        doc.font('Helvetica-Bold').fontSize(9).text('Bill to (Customer)', 56, customerY + 8);
        doc.font('Helvetica').fontSize(9);
        doc.text(tenantLabel, 56, customerY + 22);
        if (row.tenant.tradingName?.trim()) {
          doc.fontSize(8).fillColor('#555555').text(`Legal name: ${row.tenant.legalName}`, 56, customerY + 34);
          doc.fillColor('#000000').fontSize(9);
        }
        const customerContact = [
          row.tenant.contactEmail?.trim(),
          row.tenant.contactPhone?.trim(),
        ]
          .filter(Boolean)
          .join(' · ');
        if (customerContact) {
          doc.fontSize(8).text(customerContact, 300, customerY + 22, { width: 230 });
        }

        // Line items — amounts treated as VAT-inclusive at 16% (Zambia standard rate)
        const cols = [
          { label: '#', x: 48, w: 24, align: 'center' as const },
          { label: 'Description', x: 72, w: 188, align: 'left' as const },
          { label: 'Qty', x: 260, w: 32, align: 'center' as const },
          { label: 'Unit (excl.)', x: 292, w: 68, align: 'right' as const },
          { label: 'VAT', x: 360, w: 36, align: 'center' as const },
          { label: 'VAT amt', x: 396, w: 58, align: 'right' as const },
          { label: 'Total (incl.)', x: 454, w: 93, align: 'right' as const },
        ];

        let tableY = customerY + 64;
        tableY = drawTableHeader(doc, tableY, cols);

        let subtotalExcl = 0;
        let totalVat = 0;
        let grandTotal = 0;
        let rowIndex = 0;

        for (const line of row.lines) {
          const incl = Number(line.amount);
          const excl = round2(incl / (1 + ZM_VAT_RATE));
          const vat = round2(incl - excl);
          subtotalExcl = round2(subtotalExcl + excl);
          totalVat = round2(totalVat + vat);
          grandTotal = round2(grandTotal + incl);
          rowIndex += 1;

          const descH = doc.heightOfString(line.description, { width: cols[1].w - 8 });
          const rowH = Math.max(20, descH + 10);

          if (tableY + rowH > pageBottom) {
            doc.addPage();
            tableY = 72;
            tableY = drawTableHeader(doc, tableY, cols);
          }

          if (rowIndex % 2 === 0) {
            doc.save();
            doc.rect(48, tableY, 499, rowH).fill('#f8fafc');
            doc.restore();
          }
          doc.save();
          doc.rect(48, tableY, 499, rowH).stroke('#e2e8f0');
          doc.restore();

          const textY = tableY + 6;
          doc.fontSize(8).fillColor('#000000');
          doc.text(String(rowIndex), cols[0].x, textY, {
            width: cols[0].w,
            align: 'center',
          });
          doc.text(line.description, cols[1].x + 4, textY, {
            width: cols[1].w - 8,
          });
          doc.text('1', cols[2].x, textY, { width: cols[2].w, align: 'center' });
          doc.text(fmtMoney(row.currency, excl), cols[3].x, textY, {
            width: cols[3].w - 4,
            align: 'right',
          });
          doc.text('16%', cols[4].x, textY, { width: cols[4].w, align: 'center' });
          doc.text(fmtMoney(row.currency, vat), cols[5].x, textY, {
            width: cols[5].w - 4,
            align: 'right',
          });
          doc.text(fmtMoney(row.currency, incl), cols[6].x, textY, {
            width: cols[6].w - 4,
            align: 'right',
          });

          tableY += rowH;
        }

        // Totals block
        if (tableY + 90 > pageBottom) {
          doc.addPage();
          tableY = 72;
        }
        const totalsX = 340;
        const totalsW = 207;
        let totalsY = tableY + 12;
        doc.font('Helvetica').fontSize(9);
        const totalRows: [string, string][] = [
          ['Subtotal (excl. VAT)', fmtMoney(row.currency, subtotalExcl)],
          [`VAT @ ${Math.round(ZM_VAT_RATE * 100)}%`, fmtMoney(row.currency, totalVat)],
        ];
        for (const [label, value] of totalRows) {
          doc.text(label, totalsX, totalsY, { width: 110 });
          doc.text(value, totalsX + 110, totalsY, { width: totalsW - 110, align: 'right' });
          totalsY += 16;
        }
        doc.save();
        doc.rect(totalsX, totalsY, totalsW, 22).fill('#1e3a5f');
        doc.restore();
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff');
        doc.text('Total (incl. VAT)', totalsX + 8, totalsY + 6, { width: 110 });
        doc.text(fmtMoney(row.currency, grandTotal), totalsX + 110, totalsY + 6, {
          width: totalsW - 118,
          align: 'right',
        });
        doc.fillColor('#000000').font('Helvetica');
        totalsY += 34;

        if (row.notes?.trim()) {
          totalsY += 8;
          doc.fontSize(9).font('Helvetica-Bold').text('Notes', 48, totalsY);
          totalsY += 14;
          doc.font('Helvetica').text(row.notes.trim(), 48, totalsY, { width: 499 });
          totalsY += doc.heightOfString(row.notes.trim(), { width: 499 }) + 8;
        }

        if (profile.bankDetails?.trim() || profile.paymentInstructions?.trim()) {
          totalsY += 8;
          doc.font('Helvetica-Bold').fontSize(9).text('Payment details', 48, totalsY);
          totalsY += 14;
          doc.font('Helvetica').fontSize(8);
          if (profile.bankDetails?.trim()) {
            doc.text(`Bank / mobile money: ${profile.bankDetails.trim()}`, 48, totalsY, {
              width: 499,
            });
            totalsY += 14;
          }
          if (profile.paymentInstructions?.trim()) {
            doc.text(profile.paymentInstructions.trim(), 48, totalsY, { width: 499 });
            totalsY += doc.heightOfString(profile.paymentInstructions.trim(), {
              width: 499,
            });
          }
        }

        doc.fontSize(7).fillColor('#64748b');
        doc.text(
          'This is a computer-generated tax invoice. Line amounts are VAT-inclusive at the standard Zambia rate (16%) unless stated otherwise. ' +
            'Retain this document for ZRA tax purposes. Generated by Sofinda.',
          48,
          780,
          { width: 499, align: 'center' },
        );

        doc.end();
      }),
  );
}

export function invoicePdfFilename(invoiceId: string): string {
  return `tax-invoice-${invoiceId.slice(0, 8).toUpperCase()}.pdf`;
}
