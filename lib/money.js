// All amounts are stored as integer paise (₹1 = 100 paise) so splits never
// drift from floating-point rounding.

const whole = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const exact = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ₹1,500 or ₹1,500.50 — paise only shown when present
export function formatINR(paise) {
  const value = (paise || 0) / 100
  return paise % 100 === 0 ? whole.format(value) : exact.format(value)
}

// ₹950, ₹1.5k, ₹1.3L, ₹2Cr — for axis ticks and tight spots. Hand-rolled
// because browsers disagree on en-IN compact notation (Chrome prints "1.5T").
const UNITS = [[1e7, 'Cr'], [1e5, 'L'], [1e3, 'k']]
export function formatINRCompact(paise) {
  const value = Math.round((paise || 0) / 100)
  const abs = Math.abs(value)
  const unit = UNITS.find(([size]) => abs >= size)
  if (!unit) return whole.format(value)
  const scaled = Math.round((abs / unit[0]) * 10) / 10
  return `${value < 0 ? '-' : ''}₹${scaled}${unit[1]}`
}

// Averages and projections read better without paise
export function roundRupee(paise) {
  return Math.round(paise / 100) * 100
}

// "1,500.5" / "₹ 1500" → 150050 paise. Returns NaN for anything unparseable.
export function parseRupees(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? Math.round(input * 100) : NaN
  if (typeof input !== 'string') return NaN
  const cleaned = input.replace(/[₹,\s]/g, '').replace(/^rs\.?/i, '')
  if (!/^\d*\.?\d{0,2}$/.test(cleaned) || cleaned === '' || cleaned === '.') return NaN
  return Math.round(parseFloat(cleaned) * 100)
}

// 150050 → "1500.5" for pre-filling inputs
export function paiseToInput(paise) {
  if (paise == null || Number.isNaN(paise)) return ''
  const rupees = Math.floor(paise / 100)
  const rest = paise % 100
  if (!rest) return String(rupees)
  return `${rupees}.${String(rest).padStart(2, '0')}`.replace(/0$/, '')
}
