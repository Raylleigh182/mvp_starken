import { useEffect, useRef, type ReactNode } from 'react'
import { animate, motion, useInView } from 'motion/react'
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import type { Dashboard, Kpis } from '../lib/api'
import { dec, num, peso, pesoCorto, pct } from '../lib/format'

/** Número que cuenta hasta su valor al entrar en pantalla. */
function Contador({ value, fmt }: { value: number; fmt: (v: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const prev = useRef(0)
  useEffect(() => {
    if (!inView || !ref.current) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) { ref.current.textContent = fmt(value); prev.current = value; return }
    const c = animate(prev.current, value, {
      duration: 1.1, ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => { if (ref.current) ref.current.textContent = fmt(v) },
    })
    prev.current = value
    return () => c.stop()
  }, [value, inView, fmt])
  return <span ref={ref}>{fmt(value)}</span>
}

const fInt = (v: number) => num(Math.round(v))
const fPeso = (v: number) => pesoCorto(Math.round(v))
const fPct = (v: number) => pct(Math.round(v * 10) / 10)
const fDec = (v: number) => dec(v)

/** Variación vs periodo anterior: ícono + texto + color (nunca solo color). */
function Delta({ actual, previo, tipo, mejor = 'arriba' }: {
  actual: number | null | undefined; previo: number | null | undefined
  tipo: 'pct' | 'pp' | 'abs'; mejor?: 'arriba' | 'abajo'
}) {
  if (actual == null || previo == null || (tipo === 'pct' && previo === 0)) return null
  const d = tipo === 'pct' ? ((actual - previo) / previo) * 100 : actual - previo
  const neutro = Math.abs(d) < (tipo === 'abs' ? 0.01 : 0.05)
  const sube = d > 0
  const bueno = neutro ? null : (sube === (mejor === 'arriba'))
  const Icon = neutro ? Minus : sube ? TrendingUp : TrendingDown
  const txt = tipo === 'pct' ? `${sube ? '+' : ''}${dec(d)}%` : tipo === 'pp' ? `${sube ? '+' : ''}${dec(d)} pp` : `${sube ? '+' : ''}${d.toFixed(2).replace('.', ',')}`
  const cls = bueno == null ? 'text-muted' : bueno ? 'text-[#006300] dark:text-[#0ca30c]' : 'text-[#d03b3b]'
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cls}`} title="Variación respecto del periodo anterior de igual duración">
      <Icon size={13} aria-hidden /> {txt} <span className="font-normal text-muted">vs anterior</span>
    </span>
  )
}

export function Hero({ k, prev }: { k: Dashboard['kpis']; prev?: Kpis | null }) {
  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6 sm:p-8 lg:col-span-7">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full blur-3xl" style={{ background: 'var(--glow)' }} />
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Ingresos facturados · con IVA</p>
        <p className="mt-4 text-[clamp(3rem,9vw,7.5rem)] font-semibold leading-[0.9] tracking-[-0.045em] text-ink">
          <Contador value={k.ingresos} fmt={fPeso} />
        </p>
        {prev && <div className="mt-3"><Delta actual={k.ingresos} previo={prev.ingresos} tipo="pct" /></div>}
        <p className="mt-4 max-w-md text-sm text-ink-2">
          {peso(k.ingresos)} en <strong className="font-medium text-ink">{num(k.pedidos)}</strong> envíos, con un ticket promedio de{' '}
          <strong className="font-medium text-ink">{peso(k.ticket_promedio)}</strong>.
        </p>
      </motion.div>
      <div className="grid grid-cols-2 gap-4 lg:col-span-5">
        <Stat label="Pedidos" value={k.pedidos} fmt={fInt} sub={`${num(k.en_curso)} en curso`} i={1}
          delta={prev && <Delta actual={k.pedidos} previo={prev.pedidos} tipo="pct" />} />
        <Stat label="Cumplimiento SLA" value={k.sla_pct} fmt={fPct} sub="de entregados a tiempo" i={2}
          delta={prev && <Delta actual={k.sla_pct} previo={prev.sla_pct} tipo="pp" />} />
        <Stat label="Con incidencia" value={k.incidencias_pct} fmt={fPct} sub="registraron un motivo" i={3}
          delta={prev && <Delta actual={k.incidencias_pct} previo={prev.incidencias_pct} tipo="pp" mejor="abajo" />} />
        <Stat label="Calificación" value={k.calificacion} fmt={fDec} sub={`de 5 · ${dec(k.dias_transito)} días hábiles prom.`} i={4}
          delta={prev && <Delta actual={k.calificacion} previo={prev.calificacion} tipo="abs" />} />
      </div>
    </div>
  )
}

function Stat({ label, value, fmt, sub, i, delta }: { label: string; value: number | null; fmt: (v: number) => string; sub: string; i: number; delta?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.08 * i, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col justify-between rounded-3xl border border-line bg-surface p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">{label}</p>
      <div>
        <p className="mt-6 text-4xl font-semibold tracking-[-0.03em] text-ink sm:text-5xl">
          {value == null ? '—' : <Contador value={value} fmt={fmt} />}
        </p>
        <p className="mt-1.5 text-xs text-ink-2">{sub}</p>
        {delta && <div className="mt-2">{delta}</div>}
      </div>
    </motion.div>
  )
}

export function Ticker({ k }: { k: Dashboard['kpis'] }) {
  const items = [
    `${num(k.pedidos)} envíos`, `${pesoCorto(k.ingresos)} facturados`, `SLA ${pct(k.sla_pct)}`,
    `${num(k.kg_facturados)} kg facturables`, `${dec(k.dias_transito)} días hábiles en tránsito`, `★ ${dec(k.calificacion)} satisfacción`,
  ]
  const fila = items.map((t, i) => (
    <span key={i} className="flex items-center gap-8 pr-8">
      <span>{t}</span><span aria-hidden className="text-accent">✦</span>
    </span>
  ))
  return (
    <div className="relative overflow-hidden border-y border-line py-3" aria-hidden>
      <div className="marquee flex w-max whitespace-nowrap font-mono text-xs uppercase tracking-[0.2em] text-ink-2">
        {fila}{fila}{fila}{fila}
      </div>
    </div>
  )
}
