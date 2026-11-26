import { useEffect, useState } from 'react'
import { fetchStats, type Counted, type Stats } from '../lib/usage'

const rows: { key: Counted; label: string; note: string }[] = [
  { key: 'wrap', label: 'Wraps made', note: 'Real chats uploaded and turned into cards' },
  { key: 'visitor', label: 'People who stopped by', note: 'Each browser counted once' },
  { key: 'share', label: 'Cards and videos shared', note: 'From the share button' }
]

const number = new Intl.NumberFormat('en')
const shortDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en', { day: 'numeric', month: 'short' })

/** Fourteen days as thin bars, with each day's count readable on hover or focus. */
function Days({ days, values, label }: { days: string[]; values: number[]; label: string }) {
  const [active, setActive] = useState<number | null>(null)
  const peak = Math.max(1, ...values)
  const shown = active ?? values.length - 1
  return <div className="stats-days">
    <div className="stats-days__bars" role="list" aria-label={`${label}, last ${days.length} days`} onMouseLeave={() => setActive(null)}>
      {values.map((value, index) => <button type="button" role="listitem" key={days[index]} className={index === shown ? 'is-active' : ''}
        aria-label={`${shortDate(days[index])}: ${number.format(value)}`}
        onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)} onBlur={() => setActive(null)}>
        <i style={{ height: `${value ? Math.max(6, (value / peak) * 100) : 0}%` }} />
      </button>)}
    </div>
    <p className="stats-days__readout" aria-live="polite"><span>{shown === values.length - 1 ? 'Today' : shortDate(days[shown])}</span><strong>{number.format(values[shown] ?? 0)}</strong></p>
  </div>
}

export function StatsPanel() {
  const [stats, setStats] = useState<Stats>()
  const [failed, setFailed] = useState(false)
  useEffect(() => { fetchStats().then(setStats).catch(() => setFailed(true)) }, [])
  if (failed) return <p className="stats-panel__empty">The numbers aren’t available right now. Try again in a bit.</p>
  if (!stats) return <p className="stats-panel__empty" role="status">Counting…</p>
  return <div className="stats-panel">
    <p className="stats-panel__intro">Live totals since we started counting. Just numbers: no names, no chats.</p>
    {rows.map(({ key, label, note }) => <section key={key} className="stats-tile">
      <div className="stats-tile__head"><span>{label}</span><small>{note}</small></div>
      <strong className="stats-tile__total">{number.format(stats.totals[key])}</strong>
      <Days days={stats.days} values={stats.daily[key]} label={label} />
    </section>)}
  </div>
}
