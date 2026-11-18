import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { Moon, Sun, ArrowDownRight, Link2, Check } from 'lucide-react'
import { getDashboard, getFiltros, getKpis, type Filtros, type Seleccion } from './lib/api'
import { useToggleTema } from './lib/theme'
import { num, pct, peso, dec, fechaLarga, addDays } from './lib/format'
import { FilterBar, rangoPreset, type Preset } from './components/Filters'
import { Hero, Ticker } from './components/Kpis'
import { ChartCard } from './components/Card'
import { RatingBars, SegmentedBar } from './components/Charts'
import { Evolution } from './components/Evolution'
import { Explorer } from './components/Explorer'
import { Heatmap } from './components/Heatmap'
import { Tracker } from './components/Tracker'

const VACIO: Seleccion = { desde: null, hasta: null, region: null, servicio: null, canal: null }

/* ---------- Estado de filtros en la URL (vistas compartibles) ---------- */
function leerUrl(): { sel: Seleccion; preset: Preset } {
  const q = new URLSearchParams(location.search)
  const n = (k: string) => (q.get(k) ? Number(q.get(k)) : null)
  const iso = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(q.get(k) ?? '') ? q.get(k) : null)
  const preset = (['todo', '30', '90', 'mes', 'custom'].includes(q.get('p') ?? '') ? q.get('p') : 'todo') as Preset
  return { preset, sel: { desde: iso('desde'), hasta: iso('hasta'), region: n('region'), servicio: n('servicio'), canal: n('canal') } }
}
function escribirUrl(sel: Seleccion, preset: Preset) {
  const q = new URLSearchParams()
  if (preset !== 'todo') q.set('p', preset)
  if (preset === 'custom') { if (sel.desde) q.set('desde', sel.desde); if (sel.hasta) q.set('hasta', sel.hasta) }
  if (sel.region != null) q.set('region', String(sel.region))
  if (sel.servicio != null) q.set('servicio', String(sel.servicio))
  if (sel.canal != null) q.set('canal', String(sel.canal))
  const s = q.toString()
  history.replaceState(null, '', s ? `?${s}` : location.pathname)
}

/** Periodo anterior de igual duración (null si no hay datos previos). */
function periodoAnterior(sel: Seleccion, f: Filtros | undefined): Seleccion | null {
  if (!f) return null
  const desde = sel.desde ?? f.fecha_min
  const hasta = sel.hasta ?? f.fecha_max
  if (desde <= f.fecha_min) return null
  const dias = Math.round((Date.parse(hasta) - Date.parse(desde)) / 864e5) + 1
  return { ...sel, desde: addDays(desde, -dias), hasta: addDays(desde, -1) }
}

export default function App() {
  const { modo, toggle } = useToggleTema()
  const inicial = useMemo(leerUrl, [])
  const filtrosQ = useQuery({ queryKey: ['filtros'], queryFn: getFiltros, staleTime: Infinity })
  const [sel, setSel] = useState<Seleccion>(inicial.sel)
  const [preset, setPreset] = useState<Preset>(inicial.preset)
  const [copiado, setCopiado] = useState(false)
  const f = filtrosQ.data

  // Al cargar con un preset relativo en la URL, recalcular sus fechas
  useEffect(() => {
    if (f && preset !== 'todo' && preset !== 'custom') setSel((s) => ({ ...s, ...rangoPreset(preset, f) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f])
  useEffect(() => escribirUrl(sel, preset), [sel, preset])

  const dashQ = useQuery({
    queryKey: ['dashboard', sel],
    queryFn: () => getDashboard(sel),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
  const prevSel = useMemo(() => periodoAnterior(sel, f), [sel, f])
  const prevQ = useQuery({
    queryKey: ['kpis', prevSel],
    queryFn: () => getKpis(prevSel!),
    enabled: !!prevSel,
    staleTime: 60_000,
  })
  const d = dashQ.data

  const periodo = f ? `${fechaLarga(sel.desde ?? f.fecha_min)} — ${fechaLarga(sel.hasta ?? f.fecha_max)}` : ''
  const compartir = async () => {
    try { await navigator.clipboard.writeText(location.href); setCopiado(true); setTimeout(() => setCopiado(false), 1800) } catch { /* sin portapapeles */ }
  }
  const kpisGenerales = d ? {
    pedidos: d.kpis.pedidos, ingresos: d.kpis.ingresos, ticket_promedio: d.kpis.ticket_promedio, sla_pct: d.kpis.sla_pct,
    incidencias_pct: d.kpis.incidencias_pct, calificacion: d.kpis.calificacion, dias_transito: d.kpis.dias_transito,
  } : undefined

  return (
    <div className="min-h-dvh overflow-x-clip">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-8">
        {/* ---------- Encabezado ---------- */}
        <nav className="flex items-center justify-between py-5">
          <a href="./" className="flex items-center gap-2.5 text-sm font-semibold tracking-tight text-ink">
            <span className="grid size-7 place-items-center rounded-lg bg-accent text-[13px] font-bold text-white">S</span>
            Pulso Logístico
          </a>
          <div className="flex items-center gap-2">
            <a href="#explorar" className="hidden rounded-full border border-line px-4 py-2 text-sm text-ink-2 transition hover:text-ink md:block">Explorar</a>
            <a href="#rastreo" className="hidden rounded-full border border-line px-4 py-2 text-sm text-ink-2 transition hover:text-ink sm:block">Rastrear envío</a>
            <button onClick={toggle} aria-label={modo === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              className="grid size-9 place-items-center rounded-full border border-line text-ink-2 transition hover:text-ink">
              {modo === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </nav>

        <header className="pt-10 pb-12 sm:pt-16 sm:pb-16">
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
            className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
            <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-accent" /></span>
            Datos en vivo desde Supabase · {f ? `${fechaLarga(f.fecha_min)} – ${fechaLarga(f.fecha_max)}` : 'cargando'}
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 max-w-5xl text-[clamp(2.75rem,8vw,7rem)] font-semibold leading-[0.88] tracking-[-0.05em] text-ink">
            Cada envío,<br />
            <span className="text-muted">un dato que</span>{' '}
            <span className="italic text-accent">se mueve.</span>
          </motion.h1>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 flex flex-wrap items-end justify-between gap-6">
            <p className="max-w-xl text-base text-ink-2 sm:text-lg">
              Panel público de la operación de encomiendas en Chile. Elige la métrica, la granularidad y el corte de cada gráfico, y comparte la vista exacta con un enlace.
            </p>
            <a href="#panel" className="flex items-center gap-2 text-sm font-medium text-ink">Explorar el panel <ArrowDownRight size={16} /></a>
          </motion.div>
        </header>
      </div>

      {d && <Ticker k={d.kpis} />}

      <div className="mx-auto max-w-[1400px] px-4 sm:px-8">
        {f && (
          <FilterBar
            filtros={f} sel={sel} preset={preset} cargando={dashQ.isFetching}
            onPreset={(p) => { setPreset(p); setSel((s) => ({ ...s, ...rangoPreset(p, f) })) }}
            onChange={(c) => { if ('desde' in c || 'hasta' in c) setPreset('custom'); setSel((s) => ({ ...s, ...c })) }}
            onReset={() => { setPreset('todo'); setSel(VACIO) }}
          />
        )}

        <main id="panel" className="pt-8 pb-16">
          {filtrosQ.isError || dashQ.isError ? (
            <div className="rounded-3xl border border-line bg-surface p-10 text-center text-ink-2">No pudimos cargar los datos. Recarga la página en unos segundos.</div>
          ) : !d ? (
            <Esqueleto />
          ) : d.kpis.pedidos === 0 ? (
            <div className="rounded-3xl border border-line bg-surface p-10 text-center text-ink-2">No hay envíos para esta combinación de filtros.</div>
          ) : (
            <div className={`space-y-4 transition-opacity duration-300 ${dashQ.isPlaceholderData ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
                  Periodo · {periodo}{prevSel && <span className="normal-case tracking-normal"> · comparado con {fechaLarga(prevSel.desde!)} — {fechaLarga(prevSel.hasta!)}</span>}
                </p>
                <button onClick={compartir} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs text-ink-2 transition hover:text-ink">
                  {copiado ? <Check size={13} /> : <Link2 size={13} />} {copiado ? 'Enlace copiado' : 'Copiar enlace a esta vista'}
                </button>
              </div>
              <Hero k={d.kpis} prev={prevSel ? prevQ.data : null} />

              <Evolution sel={sel} />

              <div id="explorar" className="grid scroll-mt-24 gap-4 lg:grid-cols-12">
                <div className="lg:col-span-6"><Explorer sel={sel} kpis={kpisGenerales} /></div>
                <div className="lg:col-span-6"><Heatmap sel={sel} /></div>
              </div>

              <div className="grid gap-4 lg:grid-cols-12">
                <ChartCard className="lg:col-span-7" kicker="Mix" title="Pedidos por tipo de servicio"
                  rows={d.servicios} cols={[
                    { key: 'nombre', label: 'Servicio' },
                    { key: 'pedidos', label: 'Pedidos', fmt: num, align: 'right' },
                    { key: 'sla_pct', label: 'SLA', fmt: pct, align: 'right' },
                    { key: 'ingresos', label: 'Ingresos', fmt: peso, align: 'right' },
                  ]}>
                  <SegmentedBar data={d.servicios} />
                </ChartCard>
                <ChartCard className="lg:col-span-5" kicker="Experiencia" title="Calificación de clientes" delay={0.05}
                  note={`${num(d.calificaciones.reduce((a, b) => a + b.pedidos, 0))} envíos calificados · promedio ${dec(d.kpis.calificacion)} de 5`}
                  rows={d.calificaciones} cols={[
                    { key: 'estrellas', label: 'Estrellas', fmt: (v) => `${v}★` },
                    { key: 'pedidos', label: 'Pedidos', fmt: num, align: 'right' },
                  ]}>
                  <RatingBars data={d.calificaciones} />
                </ChartCard>
              </div>

              <div className="pt-8"><Tracker /></div>
            </div>
          )}
        </main>

        <footer className="flex flex-col gap-3 border-t border-line py-8 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>Datos 100% sintéticos generados para fines de análisis. No corresponden a personas ni operaciones reales.</p>
          <p className="font-mono uppercase tracking-[0.16em]">React 19 · Supabase · {new Date().getFullYear()}</p>
        </footer>
      </div>
    </div>
  )
}

function Esqueleto() {
  return (
    <div className="grid animate-pulse gap-4 lg:grid-cols-12">
      <div className="h-72 rounded-3xl bg-surface lg:col-span-7" />
      <div className="h-72 rounded-3xl bg-surface lg:col-span-5" />
      <div className="h-96 rounded-3xl bg-surface lg:col-span-12" />
    </div>
  )
}
