export const CATEGORIES = [
  { id: 'food',       label: 'Food & drinks',    icon: '🍽️' },
  { id: 'stay',       label: 'Stay',             icon: '🏨' },
  { id: 'transport',  label: 'Transport',        icon: '🚕' },
  { id: 'fuel',       label: 'Fuel & tolls',     icon: '⛽' },
  { id: 'activities', label: 'Activities',       icon: '🎟️' },
  { id: 'shopping',   label: 'Shopping',         icon: '🛍️' },
  { id: 'groceries',  label: 'Groceries & snacks', icon: '🛒' },
  { id: 'other',      label: 'Other',            icon: '📦' },
]

export const CATEGORY_IDS = CATEGORIES.map(c => c.id)

const byId = Object.fromEntries(CATEGORIES.map(c => [c.id, c]))
export function category(id) {
  return byId[id] || byId.other
}

export const PAYMENT_METHODS = [
  { id: 'upi',   label: 'UPI' },
  { id: 'cash',  label: 'Cash' },
  { id: 'card',  label: 'Card' },
  { id: 'other', label: 'Other' },
]

export const PAYMENT_METHOD_IDS = PAYMENT_METHODS.map(m => m.id)
