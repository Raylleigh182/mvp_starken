import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getMatriz, type Celda, type Seleccion } from '../lib/api'
import { METRICAS, opcionesMetrica, type ClaveMetrica } from '../lib/metricas'
import { usePaleta } from '../lib/theme'
import { num, pct, pesoCorto } from '../lib/format'
import { ChartCard } from './Card'
import { Dropdown, Segmented } from './Selectors'

type Tipo = 'dia_hora' | 'zonas' | 'servicio_zona'
type Metrica = 'pedidos' | 'ingresos' | 'ticket' | 'sla_pct' | 'incidencias_pct'

const DIAS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const ZONAS = ['Norte', 'Centro', 'Sur', 'Austral']

const CONFIG: Record<Tipo, { label: string; xs: string[]; ys: string[]; xLabel: string; yLabel: string; fx: (v: string) => string; fy: (v: string) => string }> = {
  dia_hora: {
    label: 'Día × hora de emisión',
    xs: Array.from({ length: 13 }, (_, i) => String(i + 8)), ys: ['1', '2', '3', '4', '5', '6'],
    xLabel: 'Hora', yLabel: 'Día', fx: (v) => `${v}h`, fy: (v) => DIAS[Number(v)],
  },
  zonas: {
    label: 'Zona origen × zona destino', xs: ZONAS, ys: ZONAS,
    xLabel: 'Destino', yLabel: 'Origen', fx: (v) => v, fy: (v) => v,
  },
  servicio_zona: {
    label: 'Servicio × zona destino', xs: ZONAS, ys: ['Normal', 'Express', 'Mismo Día'],
    xLabel: 'Destino', yLabel: 'Servicio', fx: (v) => v, fy: (v) => v,
  },
}

function lerp(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('')
}
function escala(ramp: readonly string[], t: number) {
  const x = Math.min(1, Math.max(0, t)) * (ramp.length - 1)
  const i = Math.min(ramp.length - 2, Math.floor(x))
  return lerp(ramp[i], ramp[i + 1], x - i)
}
function luminancia(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function Heatmap({ sel }: { sel: Seleccion }) {
  const p = usePaleta()
  const [tipo, setTipo] = useState<Tipo>('dia_hora')
  const [metrica, setMetrica] = useState<Metrica>('pedidos')
  const [foco, setFoco] = useState<Celda | null>(null)
  const cfg = CONFIG[tipo]
  const def = METRICAS[metrica as ClaveMetrica]

  const q = useQuery({
    queryKey: ['matriz', sel, tipo],
    queryFn: () => getMatriz(sel, tipo),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

  const { mapa, min, max } = useMemo(() => {
    const mapa = new Map<string, Celda>()
    const vals: number[] = []
    for (const c of q.data ?? []) {
      mapa.set(`${c.x}|${c.y}`, c)
      const v = c[metrica]
      if (v != null && (def.aditiva || c.pedidos >= 10)) vals.push(v)
    }
    return { mapa, min: Math.min(...vals), max: Math.max(...vals) }
  }, [q.data, metrica, def.aditiva])

  const grande = cfg.xs.length <= 4
  const detalle = foco ?? null

  return (
    <ChartCard kicker="Mapa de calor" title={<>{def.label} <span className="text-muted">· {cfg.label.toLowerCase()}</span></>}
      busy={q.isFetching}
      controls={<>
        <Dropdown label="Cruce" value={tipo} onChange={(v) => { setTipo(v as Tipo); setFoco(null) }}
          options={(Object.keys(CONFIG) as Tipo[]).map((k) => ({ value: k, label: CONFIG[k].label }))} />
        <Segmented size="xs" label="Métrica" value={metrica} onChange={setMetrica}
          options={opcionesMetrica(['pedidos', 'ingresos', 'ticket', 'sla_pct', 'incidencias_pct']) as { value: Metrica; label: string }[]} />
      </>}
      note={def.aditiva ? undefined : 'Celdas con menos de 10 envíos se muestran sin color.'}
      rows={(q.data ?? []).map((c) => ({ ...c, xl: cfg.fx(c.x), yl: cfg.fy(c.y) }))}
      cols={[
        { key: 'yl', label: cfg.yLabel }, { key: 'xl', label: cfg.xLabel },
        { key: 'pedidos', label: 'Pedidos', fmt: num, align: 'right' },
        { key: 'ingresos', label: 'Ingresos', fmt: pesoCorto, align: 'right' },
        { key: 'sla_pct', label: 'SLA', fmt: pct, align: 'right' },
        { key: 'incidencias_pct', label: 'Incid.', fmt: pct, align: 'right' },
      ]}>
      {/* Detalle de la celda enfocada (hover o teclado) */}
      <div className="mb-3 flex min-h-[40px] flex-wrap items-baseline gap-x-4 gap-y-1 rounded-xl bg-surface-2 px-3 py-2 text-xs" aria-live="polite">
        {detalle ? (
          <>
            <span className="font-medium text-ink">{cfg.fy(detalle.y)} · {cfg.fx(detalle.x)}</span>
            <span className="text-ink-2">Pedidos <b className="tabular font-medium text-ink">{num(detalle.pedidos)}</b></span>
            <span className="text-ink-2">Ingresos <b className="tabular font-medium text-ink">{pesoCorto(detalle.ingresos)}</b></span>
            <span className="text-ink-2">SLA <b className="tabular font-medium text-ink">{pct(detalle.sla_pct)}</b></span>
            <span className="text-ink-2">Incid. <b className="tabular font-medium text-ink">{pct(detalle.incidencias_pct)}</b></span>
          </>
        ) : <span className="text-muted">Pasa el cursor o navega con Tab sobre una celda para ver su detalle.</span>}
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[420px] gap-[2px]" style={{ gridTemplateColumns: `auto repeat(${cfg.xs.length}, minmax(0, 1fr))` }}
          onMouseLeave={() => setFoco(null)} role="grid" aria-label={cfg.label}>
          <div />
          {cfg.xs.map((x) => <div key={x} className="pb-1 text-center font-mono text-[10px] text-muted">{cfg.fx(x)}</div>)}
          {cfg.ys.map((y) => (
            <div key={y} className="contents" role="row">
              <div className="flex items-center pr-2 text-xs text-ink-2">{cfg.fy(y)}</div>
              {cfg.xs.map((x) => {
                const c = mapa.get(`${x}|${y}`)
                const v = c?.[metrica]
                const valido = c && v != null && (def.aditiva || c.pedidos >= 10)
                const t = valido && max > min ? (v! - min) / (max - min) : 0.5
                const bg = valido ? escala(p.secuencial, t) : 'transparent'
                const tinta = valido && luminancia(bg) < 0.3 ? '#ffffff' : '#0b0b0b'
                return (
                  <button key={x} role="gridcell" disabled={!c}
                    onMouseEnter={() => c && setFoco(c)} onFocus={() => c && setFoco(c)}
                    aria-label={`${cfg.fy(y)} ${cfg.fx(x)}: ${valido ? def.fmt(v!) : 'sin datos'}`}
                    className={`rounded-md border border-transparent transition-transform focus-visible:outline-2 focus-visible:outline-accent ${grande ? 'h-16' : 'h-9'} ${foco === c && c ? 'scale-[1.06] border-ink/40' : ''} ${!valido ? 'border-line' : ''}`}
                    style={{ background: bg }}>
                    {grande && valido && <span className="tabular text-xs font-medium" style={{ color: tinta }}>{def.fmt(v!)}</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {Number.isFinite(min) && (
        <div className="mt-4 flex items-center gap-3 text-[11px] text-muted">
          <span className="tabular">{def.fmt(min)}</span>
          <span className="h-2 flex-1 rounded-full" style={{ background: `linear-gradient(90deg, ${p.secuencial.join(',')})` }} />
          <span className="tabular">{def.fmt(max)}</span>
        </div>
      )}
    </ChartCard>
  )
}
