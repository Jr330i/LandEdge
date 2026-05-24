/** Download a CSV response from the API. */
export async function downloadCsvFromResponse(
  response: Response,
  filename: string,
): Promise<void> {
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Download failed (HTTP ${response.status})`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
