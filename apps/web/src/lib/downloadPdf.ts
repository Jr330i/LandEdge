/** Download a PDF response from the API, validating the %PDF magic bytes. */
export async function downloadPdfFromResponse(
  response: Response,
  filename: string,
): Promise<void> {
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Download failed (HTTP ${response.status})`);
  }

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const header = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (header !== '%PDF') {
    throw new Error(
      'Server did not return a valid PDF. Check that the API is running and migrations are applied.',
    );
  }

  const blob = new Blob([buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
