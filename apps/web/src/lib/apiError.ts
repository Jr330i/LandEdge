export async function readApiErrorMessage(r: Response): Promise<string> {
  const body = (await r.json().catch(() => ({}))) as {
    message?: string | string[]
  }
  const msg = body.message
  if (typeof msg === 'string') return msg
  if (Array.isArray(msg)) return msg.join('; ')
  return `HTTP ${r.status}`
}
