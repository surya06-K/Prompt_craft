// Short random ids. Trip ids double as the share secret, so they use the full
// base62 alphabet from a CSPRNG (12 chars ≈ 71 bits).
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

export function newId(length = 10) {
  const bytes = new Uint8Array(length)
  globalThis.crypto.getRandomValues(bytes)
  let out = ''
  // 248 = 62 * 4, so rejecting bytes >= 248 keeps the distribution uniform
  for (let i = 0; out.length < length; i++) {
    if (i >= bytes.length) { globalThis.crypto.getRandomValues(bytes); i = 0 }
    if (bytes[i] < 248) out += ALPHABET[bytes[i] % 62]
  }
  return out
}

export const TRIP_ID_LENGTH = 12
export const ID_PATTERN = /^[0-9A-Za-z]{6,32}$/

export function isId(value) {
  return typeof value === 'string' && ID_PATTERN.test(value)
}
