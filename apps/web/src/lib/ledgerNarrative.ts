/** Hide machine-readable invoice/payment tags from ledger display. */
export function displayLedgerNarrative(narrative: string): string {
  return narrative
    .replace(/^INV:[0-9a-f-]{36}\s+/i, '')
    .replace(/^Invoice [0-9a-f-]{8}…\s*/i, '')
    .replace(/\s*\[[^\]]*INV:[0-9a-f-]{36}[^\]]*\]\s*$/i, '')
    .replace(/\s+INV:[0-9a-f-]{36}/gi, '')
    .replace(/\s+REV:[0-9a-f-]{36}/gi, '')
    .trim();
}
