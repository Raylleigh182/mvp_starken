import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { Moon, Sun, ArrowDownRight } from 'lucide-react'
import { getDashboard, getFiltros, type Seleccion } from './lib/api'
import { usePaleta, useToggleTema } from './lib/theme'
import { num, pct, peso, pesoCorto, dec, mesLargo, fechaLarga } from './lib/format'
import { FilterBar, rangoPreset, type Preset } from './components/Filters'
import { Hero, Ticker } from './components/Kpis'
import { ChartCard } from './components/Card'
import { MonthlyBars, RankedBars, RatingBars, SegmentedBar, WeeklyArea } from './components/Charts'
import { Tracker } from './components/Tracker'

const VACIO: Seleccion = { desde: null, hasta: null, region: null, servicio: null, canal: null }

export default function App() {
  const { modo, toggle } = useToggleTema()
  const filtrosQ = useQuery({ queryKey: ['filtros'], queryFn: getFiltros, staleTime: Infinity })
  const [sel, setSel] = useState<Seleccion>(VACIO)
  const [preset, setPreset] = useState<Preset>('todo')

  const dashQ = useQuery({
    queryKey: ['dashboard', sel],
    queryFn: () => getDashboard(sel),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
  const d = dashQ.data
  const f = filtrosQ.data

  const periodo = useMemo(() => {
    if (!f) return ''
    return `${fechaLarga(sel.desde ?? f.fecha_min)} — ${fechaLarga(sel.hasta ?? f.fecha_max)}`
  }, [f, sel.desde, sel.hasta])

  return (
    <div className="grain min-h-dvh overflow-x-clip">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-8">
        {/* ---------- Encabezado ---------- */}
        <nav className="flex items-center justify-between py-5">
          <a href="#" className="flex items-center gap-2.5 text-sm font-semibold tracking-tight text-ink">
            <span className="grid size-7 place-items-center rounded-lg bg-accent text-[13px] font-bold text-white">S</span>
            Pulso Logístico
          </a>
          <div className="flex items-center gap-2">
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
              Panel público de la operación de encomiendas en Chile: volumen, ingresos, cumplimiento de plazos y experiencia de cliente, filtrable en tiempo real.
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
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Periodo · {periodo}</p>
              <Hero k={d.kpis} />

              <div className="grid gap-4 lg:grid-cols-12">
                <ChartCard className="lg:col-span-8" kicker="Volumen" title="Pedidos emitidos por semana"
                  note="La primera y la última semana del periodo pueden estar incompletas."
                  rows={d.semanal} cols={[
                    { key: 'semana', label: 'Semana', fmt: fechaLarga },
                    { key: 'pedidos', label: 'Pedidos', fmt: num, align: 'right' },
                    { key: 'sla_pct', label: 'SLA', fmt: pct, align: 'right' },
                  ]}>
                  <WeeklyArea data={d.semanal} />
                </ChartCard>
                <ChartCard className="lg:col-span-4" kicker="Experiencia" title="Calificación de clientes" delay={0.05}
                  note={`${num(d.calificaciones.reduce((a, b) => a + b.pedidos, 0))} envíos calificados · promedio ${dec(d.kpis.calificacion)} de 5`}
                  rows={d.calificaciones} cols={[
                    { key: 'estrellas', label: 'Estrellas', fmt: (v) => `${v}★` },
                    { key: 'pedidos', label: 'Pedidos', fmt: num, align: 'right' },
                  ]}>
                  <RatingBars data={d.calificaciones} />
                </ChartCard>
              </div>

              <div className="grid gap-4 lg:grid-cols-12">
                <ChartCard className="lg:col-span-7" kicker="Ingresos" title="Facturación mensual con IVA"
                  note="El último mes puede estar incompleto según el periodo."
                  rows={d.mensual} cols={[
                    { key: 'mes', label: 'Mes', fmt: mesLargo },
                    { key: 'pedidos', label: 'Pedidos', fmt: num, align: 'right' },
                    { key: 'ingresos', label: 'Ingresos', fmt: peso, align: 'right' },
                  ]}>
                  <MonthlyBars data={d.mensual} />
                </ChartCard>
                <ChartCard className="lg:col-span-5" kicker="Mix" title="Pedidos por tipo de servicio" delay={0.05}
                  rows={d.servicios} cols={[
                    { key: 'nombre', label: 'Servicio' },
                    { key: 'pedidos', label: 'Pedidos', fmt: num, align: 'right' },
                    { key: 'sla_pct', label: 'SLA', fmt: pct, align: 'right' },
                    { key: 'ingresos', label: 'Ingresos', fmt: peso, align: 'right' },
                  ]}>
                  <SegmentedBar data={d.servicios} />
                </ChartCard>
              </div>

              <div className="grid gap-4 lg:grid-cols-12">
                <ChartCard className="lg:col-span-7" kicker="Cobertura" title="Pedidos por región de destino"
                  rows={d.regiones} cols={[
                    { key: 'nombre', label: 'Región' }, { key: 'zona', label: 'Zona' },
                    { key: 'pedidos', label: 'Pedidos', fmt: num, align: 'right' },
                    { key: 'sla_pct', label: 'SLA', fmt: pct, align: 'right' },
                    { key: 'ingresos', label: 'Ingresos', fmt: peso, align: 'right' },
                  ]}>
                  <RankedBars data={d.regiones} value={(r) => r.pedidos} fmt={num}
                    extra={(r) => [{ label: 'Zona', value: r.zona }, { label: 'SLA', value: pct(r.sla_pct) }, { label: 'Ingresos', value: pesoCorto(r.ingresos) }]} />
                </ChartCard>
                <div className="grid gap-4 lg:col-span-5">
                  <ChartCard kicker="Puntualidad" title="Cumplimiento SLA por zona" delay={0.05}
                    note="Porcentaje de envíos entregados dentro de la fecha comprometida."
                    rows={d.zonas} cols={[
                      { key: 'nombre', label: 'Zona' },
                      { key: 'pedidos', label: 'Pedidos', fmt: num, align: 'right' },
                      { key: 'sla_pct', label: 'SLA', fmt: pct, align: 'right' },
                      { key: 'dias', label: 'Días prom.', fmt: dec, align: 'right' },
                    ]}>
                    <RankedBars data={[...d.zonas].sort((a, b) => (b.sla_pct ?? 0) - (a.sla_pct ?? 0))} value={(r) => r.sla_pct} fmt={pct} max={100} labelAll
                      extra={(r) => [{ label: 'Pedidos', value: num(r.pedidos) }, { label: 'Días hábiles', value: dec(r.dias) }]} />
                  </ChartCard>
                  <ChartCard kicker="Canales" title="Pedidos por canal de venta" delay={0.1}
                    rows={d.canales} cols={[
                      { key: 'nombre', label: 'Canal' },
                      { key: 'pedidos', label: 'Pedidos', fmt: num, align: 'right' },
                      { key: 'ingresos', label: 'Ingresos', fmt: peso, align: 'right' },
                    ]}>
                    <RankedBars data={d.canales} value={(r) => r.pedidos} fmt={num}
                      extra={(r) => [{ label: 'Ingresos', value: pesoCorto(r.ingresos) }]} />
                  </ChartCard>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-12">
                <ChartCard className="lg:col-span-6" kicker="Fricción" title="Motivos de incidencia"
                  note="Un envío entregado también puede haber tenido una incidencia previa."
                  rows={d.incidencias} cols={[
                    { key: 'nombre', label: 'Motivo' },
                    { key: 'pedidos', label: 'Pedidos', fmt: num, align: 'right' },
                  ]}>
                  <RankedBars data={d.incidencias} value={(r) => r.pedidos} fmt={num} />
                </ChartCard>
                <ChartCard className="lg:col-span-6" kicker="Carga" title="Contenido declarado" delay={0.05}
                  rows={d.contenidos} cols={[
                    { key: 'nombre', label: 'Contenido' },
                    { key: 'pedidos', label: 'Pedidos', fmt: num, align: 'right' },
                  ]}>
                  <RankedBars data={d.contenidos} value={(r) => r.pedidos} fmt={num} />
                </ChartCard>
              </div>

              <div className="grid gap-4 lg:grid-cols-12">
                <ChartCard className="lg:col-span-5" kicker="Seguimiento" title="Estado actual de los envíos"
                  rows={d.estados} cols={[
                    { key: 'nombre', label: 'Estado' },
                    { key: 'pedidos', label: 'Pedidos', fmt: num, align: 'right' },
                  ]}>
                  <RankedBars data={d.estados} value={(r) => r.pedidos} fmt={num} />
                </ChartCard>
                <ChartCard className="lg:col-span-7" kicker="Red" title="Top 10 sucursales de origen" delay={0.05}>
                  <TopSucursales rows={d.sucursales} />
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

function TopSucursales({ rows }: { rows: { nombre: string; pedidos: number; ingresos: number; sla_pct: number | null }[] }) {
  const p = usePaleta()
  const max = Math.max(...rows.map((r) => r.pedidos), 1)
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th className="w-8 py-2 font-normal">#</th>
            <th className="py-2 font-normal">Sucursal</th>
            <th className="py-2 font-normal">Pedidos</th>
            <th className="py-2 text-right font-normal">SLA</th>
            <th className="py-2 text-right font-normal">Ingresos</th>
          </tr>
        </thead>
        <tbody className="tabular">
          {rows.map((r, i) => (
            <tr key={r.nombre} className="border-b border-line/60 last:border-0">
              <td className="py-2.5 font-mono text-xs text-muted">{String(i + 1).padStart(2, '0')}</td>
              <td className="py-2.5 text-ink">{r.nombre.replace('Starken ', '')}</td>
              <td className="py-2.5">
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-2 sm:w-36">
                    <div className="h-full rounded-full" style={{ width: `${(r.pedidos / max) * 100}%`, background: p.s[0] }} />
                  </div>
                  <span className="text-ink-2">{num(r.pedidos)}</span>
                </div>
              </td>
              <td className="py-2.5 text-right text-ink-2">{pct(r.sla_pct)}</td>
              <td className="py-2.5 text-right text-ink">{pesoCorto(r.ingresos)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Esqueleto() {
  return (
    <div className="grid animate-pulse gap-4 lg:grid-cols-12">
      <div className="h-72 rounded-3xl bg-surface lg:col-span-7" />
      <div className="h-72 rounded-3xl bg-surface lg:col-span-5" />
      <div className="h-80 rounded-3xl bg-surface lg:col-span-8" />
      <div className="h-80 rounded-3xl bg-surface lg:col-span-4" />
    </div>
  )
}
