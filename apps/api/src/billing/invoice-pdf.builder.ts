import type { Invoice, InvoiceLine, Organization, Tenant } from '@prisma/client';
import PDFDocument from 'pdfkit';

export type InvoicePdfRow = Invoice & {
  lines: InvoiceLine[];
  tenant: Pick<Tenant, 'legalName' | 'tradingName'>;
  organization: Pick<Organization, 'name'>;
};

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmtMoney(currency: string, n: number): string {
  return `${currency} ${n.toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function renderInvoicePdf(row: InvoicePdfRow): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = 48;
    const amountX = 452;
    const descWidth = 380;
    const amountWidth = 100;
    const pageBottom = 780;

    const tenantLabel =
      row.tenant.tradingName?.trim() || row.tenant.legalName;

    doc.fontSize(18).text(row.organization.name);
    doc.moveDown(0.25);
    doc.fontSize(11).fillColor('#444').text('Invoice');
    doc.fillColor('#000000');
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(`Invoice ID: ${row.id}`);
    doc.text(`Status: ${row.status}`);
    doc.text(
      `Period: ${fmtDate(row.periodStart)} – ${fmtDate(row.periodEnd)}`,
    );
    if (row.dueDate) {
      doc.text(`Due: ${fmtDate(row.dueDate)}`);
    }
    doc.text(`Currency: ${row.currency}`);
    doc.moveDown();
    doc.fontSize(11).text('Bill to', { underline: true });
    doc.fontSize(10);
    doc.text(tenantLabel);
    if (row.tenant.tradingName?.trim()) {
      doc.text(`Legal name: ${row.tenant.legalName}`);
    }
    doc.moveDown();

    const headerY = doc.y;
    doc.font('Helvetica-Bold');
    doc.text('Description', left, headerY);
    doc.text('Amount', amountX, headerY, {
      width: amountWidth,
      align: 'right',
    });
    doc.font('Helvetica');
    const ruleY = headerY + 14;
    doc.moveTo(left, ruleY).lineTo(amountX + amountWidth, ruleY).stroke();

    let rowY = ruleY + 10;
    for (const line of row.lines) {
      const desc = line.description;
      const h = doc.heightOfString(desc, { width: descWidth });
      if (rowY + h + 48 > pageBottom) {
        doc.addPage();
        rowY = 72;
      }
      doc.text(desc, left, rowY, { width: descWidth });
      doc.text(
        fmtMoney(row.currency, Number(line.amount)),
        amountX,
        rowY,
        { width: amountWidth, align: 'right' },
      );
      rowY += Math.max(h, 14) + 8;
    }

    const totalRuleY = rowY + 4;
    doc.moveTo(left, totalRuleY).lineTo(amountX + amountWidth, totalRuleY).stroke();
    const total = row.lines.reduce((s, l) => s + Number(l.amount), 0);
    const totalY = totalRuleY + 10;
    doc.font('Helvetica-Bold');
    doc.text('Total', left, totalY);
    doc.text(
      fmtMoney(row.currency, total),
      amountX,
      totalY,
      { width: amountWidth, align: 'right' },
    );
    doc.font('Helvetica');
    doc.y = totalY + 22;

    if (row.notes?.trim()) {
      doc.moveDown(1.5);
      doc.fontSize(10).text('Notes', { underline: true });
      doc.text(row.notes.trim(), { width: 500 });
    }

    doc.moveDown(2);
    doc.fontSize(8).fillColor('#888888');
    doc.text(
      `Generated ${new Date().toISOString().slice(0, 19)}Z · Sofinda`,
    );

    doc.end();
  });
}
