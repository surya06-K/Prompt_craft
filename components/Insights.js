'use client'
import { formatINR, formatINRCompact, roundRupee } from '@/lib/money'
import { PAYMENT_METHODS } from '@/lib/categories'
import { budgetPace, budgetStatus, byCategory, byDay, byMethod, byPerson, elapsedDays, sumAmounts, todayISO, tripRange } from '@/lib/insights'
import { Avatar, Icon, formatDate, nameOf } from './ui'
import { ChartCard, Legend, TipRows, niceScale, useTooltip } from './charts'

// space kept to the right of the longest bar for its value label
const LABEL_ROOM = 100

const STATUS = {
  ok: { icon: 'check', label: 'On budget', cls: 'notice-good' },
  warning: { icon: 'alert', label: 'Close to budget', cls: 'notice-warn' },
  over: { icon: 'alert', label: 'Over budget', cls: 'notice-bad' },
}

export function InsightsTab({ trip, members, expenses, me, onOpenSettings, onOpenExpense }) {
  const [tipNode, bind] = useTooltip()
  const total = sumAmounts(expenses)
  const range = tripRange(trip, expenses)
  const pace = budgetPace(trip, expenses)
  const status = budgetStatus(total, trip.budget)
  const cats = byCategory(expenses, trip.categoryBudgets)
  const overCats = cats.filter(c => c.budget && c.total > c.budget)
  const days = byDay(expenses, range)
  const people = byPerson(members, expenses)
  const top = [...expenses].sort((a, b) => b.amount - a.amount).slice(0, 5)
  const today = todayISO()
  const elapsed = elapsedDays(range, today)
  const perDayNote = !range ? 'no dates yet'
    : today < range.start ? `trip starts ${formatDate(range.start, { day: 'numeric', month: 'short' })}`
    : `over ${elapsed} day${elapsed === 1 ? '' : 's'}${today <= range.end ? ' so far' : ''}`

  if (!expenses.length && !trip.budget) {
    return (
      <div className="card empty">
        <div className="big">📊</div>
        <p className="strong" style={{ color: 'var(--text)' }}>Charts show up once you log expenses</p>
        <p className="small" style={{ margin: '4px 0 14px' }}>You can set a trip budget now to track spending against it.</p>
        <button className="btn" onClick={onOpenSettings}>Set a budget</button>
      </div>
    )
  }

  return (
    <div className="stack">
      {tipNode}
      <div className="stats">
        <div className="stat">
          <div className="stat-label">Total spent</div>
          <div className="stat-value">{formatINR(total)}</div>
          <div className="stat-sub">{expenses.length} expenses</div>
        </div>
        <div className="stat">
          <div className="stat-label">Per person</div>
          <div className="stat-value">{formatINR(roundRupee(total / Math.max(1, members.length)))}</div>
          <div className="stat-sub">average share</div>
        </div>
        <div className="stat">
          <div className="stat-label">Per day</div>
          <div className="stat-value">{formatINR(roundRupee(total / elapsed))}</div>
          <div className="stat-sub">{perDayNote}</div>
        </div>
      </div>

      {trip.budget ? (
        <section className="card stack">
          <div className="row-between">
            <h3 className="card-title">Trip budget</h3>
            <span className={`notice ${STATUS[status.level].cls}`} style={{ padding: '3px 10px', fontSize: 13 }}>
              <Icon name={STATUS[status.level].icon} size={14} />{STATUS[status.level].label}
            </span>
          </div>
          <div>
            <span className="stat-value">{formatINR(total)}</span>
            <span className="secondary"> of {formatINR(trip.budget)}</span>
          </div>
          <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={trip.budget} aria-valuenow={total} aria-label="Budget used">
            <div className="meter-fill" data-level={status.level} style={{ width: `${Math.min(100, status.ratio * 100)}%` }} />
          </div>
          <div className="small secondary">
            {status.remaining >= 0
              ? `${formatINR(roundRupee(status.remaining))} left (${Math.round((1 - status.ratio) * 100)}%)`
              : `${formatINR(roundRupee(-status.remaining))} over budget`}
          </div>
          {pace && pace.elapsed > 0 && (
            <div className="small secondary">
              Daily budget {formatINR(roundRupee(pace.perDay))} · averaging {formatINR(roundRupee(pace.avgPerDay))}/day ·
              at this pace the trip will cost about <strong>{formatINR(roundRupee(pace.projected))}</strong>
              {pace.projected > trip.budget ? ` (${formatINR(roundRupee(pace.projected - trip.budget))} over)` : ''}
            </div>
          )}
          {overCats.map(c => (
            <div key={c.category.id} className="notice notice-bad small">
              <Icon name="alert" size={14} />{c.category.icon} {c.category.label} is {formatINR(c.total - c.budget)} over its {formatINR(c.budget)} budget
            </div>
          ))}
        </section>
      ) : (
        <div className="notice notice-info">
          <Icon name="chart" size={16} />
          <span className="grow">Set a trip budget to see how you&apos;re tracking.</span>
          <button className="btn btn-sm" onClick={onOpenSettings}>Set budget</button>
        </div>
      )}

      {cats.length > 0 && <CategoryChart cats={cats} total={total} bind={bind} />}
      {days.length > 1 && <DailyChart days={days} perDay={pace?.perDay} today={today} bind={bind} />}
      {expenses.length > 0 && <PeopleChart people={people} members={members} me={me} bind={bind} />}
      {expenses.length > 0 && <MethodCard expenses={expenses} total={total} />}

      {top.length > 0 && (
        <section className="card stack">
          <h3 className="card-title">Biggest expenses</h3>
          <div className="list" style={{ border: 'none' }}>
            {top.map((e, i) => (
              <button className="list-item" key={e.id} onClick={() => onOpenExpense(e)} style={{ padding: '8px 0' }}>
                <span className="muted num" style={{ width: 18 }}>{i + 1}</span>
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="ellipsis" style={{ display: 'block' }}>{e.title}</span>
                  <span className="small muted">{nameOf(members, e.paidBy, me)} paid · {formatDate(e.date, { day: 'numeric', month: 'short' })}</span>
                </span>
                <span className="item-amount num">{formatINR(e.amount)}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// Single series → one hue for every bar. Budget markers are ink ticks, and
// over-budget rows carry an icon + label, never colour alone.
function CategoryChart({ cats, total, bind }) {
  const rows = [...cats].sort((a, b) => b.total - a.total)
  const max = Math.max(...rows.map(r => Math.max(r.total, r.budget)))
  const hasBudgets = rows.some(r => r.budget)

  return (
    <ChartCard
      title="Spending by category"
      sub={hasBudgets ? 'Dark tick = category budget' : undefined}
      table={
        <table className="table">
          <thead><tr><th>Category</th><th className="r">Spent</th><th className="r">Share</th>{hasBudgets && <th className="r">Budget</th>}</tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.category.id}>
                <td>{r.category.icon} {r.category.label}</td>
                <td className="r">{formatINR(r.total)}</td>
                <td className="r">{total ? Math.round((r.total / total) * 100) : 0}%</td>
                {hasBudgets && <td className="r">{r.budget ? formatINR(r.budget) : '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div className="hbars">
        {rows.map(r => {
          const over = r.budget > 0 && r.total > r.budget
          return (
            <div className="hbar-row" key={r.category.id}>
              <span className="hbar-label"><span aria-hidden="true">{r.category.icon}</span><span className="ellipsis">{r.category.label}</span></span>
              <div className="hbar-track hit"
                aria-label={`${r.category.label}: ${formatINR(r.total)}${r.budget ? ` of ${formatINR(r.budget)} budget` : ''}`}
                {...bind(<TipRows title={r.category.label} rows={[
                  { label: `${r.count} expense${r.count === 1 ? '' : 's'} · ${total ? Math.round((r.total / total) * 100) : 0}%`, value: formatINR(r.total), color: 'var(--series-1)' },
                  ...(r.budget ? [{ label: over ? 'over budget' : 'left in budget', value: formatINR(Math.abs(r.budget - r.total)) }] : []),
                ]} />)}>
                <div className="hbar" style={{ width: `calc((100% - ${LABEL_ROOM}px) * ${r.total / max})`, flex: 'none' }} />
                <span className="hbar-value">{formatINRCompact(r.total)}</span>
                {over && <span className="bad tiny row" style={{ gap: 2 }}><Icon name="alert" size={12} />over</span>}
                {r.budget > 0 && <span className="budget-tick" style={{ left: `calc((100% - ${LABEL_ROOM}px) * ${r.budget / max})` }} />}
              </div>
            </div>
          )
        })}
      </div>
    </ChartCard>
  )
}

function DailyChart({ days, perDay, today, bind }) {
  const peak = Math.max(...days.map(d => d.total), perDay || 0)
  const { max, step } = niceScale(peak, 3)
  const ticks = []
  for (let v = 0; v <= max; v += step) ticks.push(v)
  const labelEvery = Math.ceil(days.length / 10)

  return (
    <ChartCard
      title="Spending by day"
      sub={perDay ? `Line = daily budget (${formatINR(roundRupee(perDay))})` : undefined}
      table={
        <table className="table">
          <thead><tr><th>Day</th><th>Date</th><th className="r">Spent</th></tr></thead>
          <tbody>
            {days.map(d => <tr key={d.date}><td>Day {d.day}</td><td>{formatDate(d.date)}</td><td className="r">{formatINR(d.total)}</td></tr>)}
          </tbody>
        </table>
      }
    >
      <div className="cols">
        <div className="cols-axis" aria-hidden="true">
          {ticks.map(t => <span key={t} style={{ bottom: `${(t / max) * 100}%` }}>{formatINRCompact(t)}</span>)}
        </div>
        <div className="cols-scroll">
          <div style={{ minWidth: days.length * 12 }}>
            <div className="cols-plot">
              {ticks.slice(1).map(t => <span key={t} className="gridline" style={{ bottom: `${(t / max) * 100}%` }} />)}
              {perDay > 0 && (
                <span className="ref-line" style={{ bottom: `${(perDay / max) * 100}%` }}>
                  <span className="ref-label">daily budget</span>
                </span>
              )}
              {days.map(d => (
                <div className="col-hit" key={d.date} data-today={d.date === today}
                  aria-label={`Day ${d.day}, ${formatDate(d.date)}: ${formatINR(d.total)}`}
                  {...bind(<TipRows title={`Day ${d.day} · ${formatDate(d.date)}${d.date === today ? ' (today)' : ''}`} rows={[
                    { label: 'spent', value: formatINR(d.total), color: 'var(--series-1)' },
                    ...(perDay ? [{ label: d.total > perDay ? 'over daily budget' : 'under daily budget', value: formatINR(Math.abs(perDay - d.total)) }] : []),
                  ]} />)}>
                  <div className="col" style={{ height: `${(d.total / max) * 100}%` }} />
                </div>
              ))}
            </div>
            <div className="cols-x" aria-hidden="true">
              {days.map((d, i) => (
                <span key={d.date}>{i % labelEvery === 0 ? formatDate(d.date, { day: 'numeric', month: 'short' }) : ''}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ChartCard>
  )
}

// Two series (paid vs share) → categorical slots 1 and 2, with a legend and
// values at the bar tips.
function PeopleChart({ people, members, me, bind }) {
  const max = Math.max(1, ...people.flatMap(p => [p.paid, p.share]))
  const series = [
    { key: 'paid', label: 'Paid for the group', color: 'var(--series-1)' },
    { key: 'share', label: 'Their share', color: 'var(--series-2)' },
  ]
  return (
    <ChartCard
      title="Who paid vs. who spent"
      sub="Paid more than their share → the group owes them"
      legend={<Legend items={series} />}
      table={
        <table className="table">
          <thead><tr><th>Person</th><th className="r">Paid</th><th className="r">Share</th><th className="r">Difference</th></tr></thead>
          <tbody>
            {people.map(p => (
              <tr key={p.member.id}>
                <td>{nameOf(members, p.member.id, me)}</td>
                <td className="r">{formatINR(p.paid)}</td>
                <td className="r">{formatINR(p.share)}</td>
                <td className="r">{p.paid - p.share >= 0 ? '+' : '−'}{formatINR(Math.abs(p.paid - p.share))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div className="hbars">
        {people.map(p => (
          <div className="hbar-row" key={p.member.id}>
            <span className="hbar-label"><Avatar members={members} id={p.member.id} size="sm" /><span className="ellipsis">{nameOf(members, p.member.id, me)}</span></span>
            <div className="pair"
              aria-label={`${p.member.name}: paid ${formatINR(p.paid)}, share ${formatINR(p.share)}`}
              {...bind(<TipRows title={p.member.name} rows={series.map(s => ({ label: s.label.toLowerCase(), value: formatINR(p[s.key]), color: s.color }))} />)}>
              {series.map(s => (
                <div className="hbar-track" key={s.key} style={{ minHeight: 12 }}>
                  <div className="hbar hbar-2" style={{ width: `calc((100% - ${LABEL_ROOM}px) * ${p[s.key] / max})`, flex: 'none', background: s.color }} />
                  <span className="hbar-value">{formatINRCompact(p[s.key])}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ChartCard>
  )
}

function MethodCard({ expenses, total }) {
  const totals = byMethod(expenses)
  const rows = PAYMENT_METHODS.map(m => ({ ...m, total: totals[m.id] || 0 })).filter(r => r.total)
  if (rows.length < 2) return null
  return (
    <section className="card stack">
      <h3 className="card-title">How it was paid</h3>
      <table className="table">
        <tbody>
          {rows.sort((a, b) => b.total - a.total).map(r => (
            <tr key={r.id}>
              <td>{r.id === 'other' ? 'Other / not set' : r.label}</td>
              <td className="r">{formatINR(r.total)}</td>
              <td className="r muted" style={{ width: 60 }}>{Math.round((r.total / total) * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
