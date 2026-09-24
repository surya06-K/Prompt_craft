'use client'
import { useState } from 'react'
import { Icon } from './ui'

// A single floating tooltip shared by every mark in a chart. Marks get the
// same readout on hover and on keyboard focus.
export function useTooltip() {
  const [tip, setTip] = useState(null)
  const hide = () => setTip(null)
  function bind(content) {
    return {
      tabIndex: 0,
      onPointerMove: e => setTip({ x: e.clientX, y: e.clientY, content }),
      onPointerLeave: hide,
      onFocus: e => {
        const r = e.currentTarget.getBoundingClientRect()
        setTip({ x: r.left + r.width / 2, y: r.top, content })
      },
      onBlur: hide,
    }
  }
  const x = tip ? Math.min(Math.max(tip.x, 80), (typeof window !== 'undefined' ? window.innerWidth : 400) - 80) : 0
  const node = tip ? <div className="tooltip" style={{ left: x, top: tip.y }} role="presentation">{tip.content}</div> : null
  return [node, bind]
}

export function TipRows({ title, rows }) {
  return (
    <>
      {title && <div className="tiny muted" style={{ marginBottom: 4 }}>{title}</div>}
      {rows.map(r => (
        <div className="tt-row" key={r.label}>
          {r.color && <span className="tt-key" style={{ background: r.color }} />}
          <span className="tt-value">{r.value}</span>
          <span className="small muted">{r.label}</span>
        </div>
      ))}
    </>
  )
}

// Round a max value up to a clean axis: 0 / 2,000 / 4,000 …
export function niceScale(max, ticks = 4) {
  if (max <= 0) return { max: 1, step: 1 }
  const rough = max / ticks
  const mag = Math.pow(10, Math.floor(Math.log10(rough)))
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= rough)
  return { max: Math.ceil(max / step) * step, step }
}

// Card wrapper with a chart / table toggle, so every value is reachable
// without hovering.
export function ChartCard({ title, sub, legend, table, children }) {
  const [showTable, setShowTable] = useState(false)
  return (
    <section className="card chart-card">
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <div>
          <h3 className="card-title">{title}</h3>
          {sub && <div className="card-sub">{sub}</div>}
        </div>
        {table && (
          <button className="btn btn-ghost btn-sm" onClick={() => setShowTable(s => !s)} aria-pressed={showTable}>
            <Icon name={showTable ? 'chart' : 'table'} size={14} /> {showTable ? 'Chart' : 'Table'}
          </button>
        )}
      </div>
      {!showTable && legend}
      {showTable ? <div className="table-wrap">{table}</div> : children}
    </section>
  )
}

export function Legend({ items }) {
  return (
    <div className="legend">
      {items.map(i => <span key={i.label}><span className="legend-key" style={{ background: i.color }} />{i.label}</span>)}
    </div>
  )
}
