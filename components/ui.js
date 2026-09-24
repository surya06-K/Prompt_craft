'use client'
import { useEffect, useRef, useState } from 'react'

const ICONS = {
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  scale: 'M12 3v18M5 7h14M5 7l-3 7a3.5 3.5 0 0 0 6 0L5 7zM19 7l-3 7a3.5 3.5 0 0 0 6 0l-3-7zM8 21h8',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  share: 'M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  camera: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  receipt: 'M5 3v18l2.5-1.5L10 21l2-1.5 2 1.5 2.5-1.5L19 21V3l-2.5 1.5L14 3l-2 1.5L10 3 7.5 4.5zM9 9h6M9 13h6',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  check: 'M20 6L9 17l-5-5',
  alert: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  back: 'M19 12H5M11 18l-6-6 6-6',
  external: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3',
  table: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15',
}

export function Icon({ name, size = 18, strokeWidth = 2, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      <path d={ICONS[name]} />
    </svg>
  )
}

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase()
}

// Colour follows the person's position on the trip, never their rank.
export function memberColor(members, id) {
  const i = Math.max(0, members.findIndex(m => m.id === id)) % 8
  return { '--c': `var(--m${i})`, '--c-ink': `var(--m${i}-ink)` }
}

export function Avatar({ members, id, size = '' }) {
  const m = members.find(x => x.id === id)
  return (
    <span className={`avatar ${size ? `avatar-${size}` : ''}`} style={memberColor(members, id)} aria-hidden="true">
      {initials(m?.name)}
    </span>
  )
}

export function nameOf(members, id, me) {
  if (id && id === me) return 'You'
  return members.find(m => m.id === id)?.name || 'Someone'
}

export function Sheet({ title, onClose, children, footer, labelledBy }) {
  const ref = useRef(null)
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const prevFocus = document.activeElement
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const target = ref.current?.querySelector('[data-autofocus]') || ref.current
    target?.focus()
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey)
      prevFocus?.focus?.()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={labelledBy ? undefined : title} ref={ref} tabIndex={-1}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function useToast() {
  const [message, setMessage] = useState('')
  const timer = useRef(null)
  function show(text) {
    setMessage(text)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setMessage(''), 2600)
  }
  const node = message ? <div className="toast" role="status">{message}</div> : null
  return [node, show]
}

export function formatDate(iso, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', opts)
}

export function timeAgo(ts) {
  if (!ts) return ''
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function tripDates(trip) {
  if (!trip.startDate) return ''
  const start = formatDate(trip.startDate, { day: 'numeric', month: 'short' })
  if (!trip.endDate || trip.endDate === trip.startDate) return start
  return `${start} – ${formatDate(trip.endDate, { day: 'numeric', month: 'short' })}`
}
