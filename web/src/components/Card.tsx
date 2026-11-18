import { useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Table2, BarChart3 } from 'lucide-react'

type Col<T> = { key: keyof T; label: string; fmt?: (v: any) => string; align?: 'left' | 'right' }

/** Tarjeta de gráfico con vista de tabla equivalente (accesibilidad). */
export function ChartCard<T extends Record<string, any>>({
  kicker, title, note, children, rows, cols, className = '', delay = 0, controls, busy = false,
}: {
  kicker: string
  title: ReactNode
  note?: ReactNode
  children: ReactNode
  rows?: T[]
  cols?: Col<T>[]
  className?: string
  delay?: number
  controls?: ReactNode
  busy?: boolean
}) {
  const [tabla, setTabla] = useState(false)
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`group relative flex flex-col rounded-3xl border border-line bg-surface p-5 sm:p-6 ${className}`}
    >
      <header className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">{kicker}</p>
          <h3 className="mt-1.5 text-lg font-medium leading-tight tracking-tight text-ink sm:text-xl">{title}</h3>
        </div>
        {rows && cols && (
          <button
            onClick={() => setTabla((v) => !v)}
            className="shrink-0 rounded-full border border-line p-2 text-ink-2 transition hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
            aria-pressed={tabla}
            aria-label={tabla ? 'Ver gráfico' : 'Ver tabla'}
            title={tabla ? 'Ver gráfico' : 'Ver tabla'}
          >
            {tabla ? <BarChart3 size={16} /> : <Table2 size={16} />}
          </button>
        )}
      </header>
      {controls && <div className="-mt-1 mb-5 flex flex-wrap items-center gap-2">{controls}</div>}
      <div className={`flex-1 transition-opacity duration-300 ${busy ? 'opacity-50' : ''}`} aria-busy={busy}>
        {tabla && rows && cols ? <DataTable rows={rows} cols={cols} /> : children}
      </div>
      {note && <p className="mt-4 text-xs leading-relaxed text-muted">{note}</p>}
    </motion.section>
  )
}

export function DataTable<T extends Record<string, any>>({ rows, cols }: { rows: T[]; cols: Col<T>[] }) {
  return (
    <div className="max-h-[340px] overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-surface">
          <tr className="border-b border-line text-left text-xs text-muted">
            {cols.map((c) => (
              <th key={String(c.key)} className={`py-2 pr-3 font-normal ${c.align === 'right' ? 'text-right' : ''}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular">
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line/60 last:border-0">
              {cols.map((c) => (
                <td key={String(c.key)} className={`py-2 pr-3 ${c.align === 'right' ? 'text-right text-ink' : 'text-ink-2'}`}>
                  {c.fmt ? c.fmt(r[c.key]) : String(r[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Tooltip común: texto en tinta, color solo en el marcador. */
export function Tip({ title, items }: { title: string; items: { color?: string; label: string; value: string }[] }) {
  return (
    <div className="pointer-events-none min-w-[160px] rounded-xl border border-line bg-surface px-3 py-2.5 shadow-xl shadow-black/10">
      <p className="mb-1.5 text-xs font-medium text-ink">{title}</p>
      {items.map((it) => (
        <div key={it.label} className="flex items-center justify-between gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-ink-2">
            {it.color && <span className="inline-block size-2 rounded-full" style={{ background: it.color }} />}
            {it.label}
          </span>
          <span className="tabular font-medium text-ink">{it.value}</span>
        </div>
      ))}
    </div>
  )
}
