function formatIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function buildInvoiceLedgerNarrative(
  lines: Array<{ description: string }>,
  periodStart: Date,
  periodEnd: Date,
): string {
  const descriptions = lines
    .map((l) => l.description.trim())
    .filter(Boolean);
  const label = descriptions.length > 0 ? descriptions.join('; ') : 'Invoice';
  const period = `${formatIsoDate(periodStart)}–${formatIsoDate(periodEnd)}`;
  return `${label} (${period})`;
}

export function buildPaymentLedgerNarrative(
  invoiceTag: string,
  label?: string | null,
): string {
  const human = label?.trim() || 'Payment allocation';
  return `${human} [${invoiceTag}]`;
}

export function buildReversalLedgerNarrative(
  invoiceTag: string,
  reverseTag: string,
  reason?: string | null,
): string {
  const human = reason?.trim() || 'Payment reversal';
  return `${human} [${invoiceTag} ${reverseTag}]`;
}

/** True when narrative uses the old invoice-id prefix pattern. */
export function isLegacyInvoiceLedgerNarrative(
  narrative: string,
  invoiceId: string,
): boolean {
  const prefix = invoiceId.slice(0, 8);
  return (
    narrative.includes(`Invoice ${prefix}`) ||
    narrative.startsWith(`Invoice ${prefix}`)
  );
}
