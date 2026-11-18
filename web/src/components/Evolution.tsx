import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getSerie, type PuntoSerie, type Seleccion } from '../lib/api'
import { METRICAS, ORDEN_GRUPOS, opcionesMetrica, type ClaveMetrica } from '../lib/metricas'
import { usePaleta } from '../lib/theme'
import { fechaCorta, fechaLarga, mesCorto, mesLargo } from '../lib/format'
import { ChartCard, Tip } from './Card'
import { Dropdown, Segmented } from './Selectors'

type Grano = 'dia' | 'semana' | 'mes'
type Metrica = Exclude<ClaveMetrica, 'dias'>

const DESGLOSES = [
  { value: 'ninguno', label: 'Sin desglose' },
  { value: 'servicio', label: 'Tipo de servicio' },
  { value: 'zona_destino', label: 'Zona de destino' },
  { value: 'tipo_entrega', label: 'Tipo de entrega' },
  { value: 'tipo_cliente', label: 'Tipo de cliente' },
  { value: 'canal', label: 'Canal de venta' },
]

const tick = (c: string) => ({ fill: c, fontSize: 11, fontFamily: 'Geist Mono Variable, monospace' })

export function Evolution({ sel }: { sel: Seleccion }) {
  const p = usePaleta()
  const [metrica, setMetrica] = useState<Metrica>('pedidos')
  const [grano, setGrano] = useState<Grano>('semana')
  const [desglose, setDesglose] = useState('ninguno')
  const des = desglose === 'ninguno' ? null : desglose
  const def = METRICAS[metrica]

  const q = useQuery({
    queryKey: ['serie', sel, grano, des],
    queryFn: () => getSerie(sel, grano, des),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

  const { filas, grupos } = useMemo(() => pivot(q.data ?? [], metrica, des), [q.data, metrica, des])
  const fmtX = grano === 'mes' ? mesCorto : fechaCorta
  const fmtTitulo = grano === 'mes' ? mesLargo : grano === 'semana' ? (d: string) => `Semana del ${fechaLarga(d)}` : fechaLarga
  const multi = grupos.length > 0
  const color = (g: string) => p.s[Math.max(0, (ORDEN_GRUPOS[des ?? ''] ?? grupos).indexOf(g)) % p.s.length]
  const ultimo = filas[filas.length - 1]

  const controls = (
    <>
      <Segmented label="Métrica" value={metrica} onChange={setMetrica}
        options={opcionesMetrica(['pedidos', 'ingresos', 'ticket', 'sla_pct', 'incidencias_pct', 'calificacion']) as { value: Metrica; label: string }[]} />
      <Segmented label="Granularidad" value={grano} onChange={setGrano}
        options={[{ value: 'dia', label: 'Día' }, { value: 'semana', label: 'Semana' }, { value: 'mes', label: 'Mes' }]} />
      <Dropdown label="Desglose" value={desglose} onChange={setDesglose} options={DESGLOSES} />
    </>
  )

  const tooltip = (
    <Tooltip
      cursor={{ stroke: p.axis, strokeWidth: 1 }}
      content={({ active, payload, label }) => active && payload?.length ? (
        <Tip title={fmtTitulo(String(label))}
          items={payload
            .filter((x) => x.value != null)
            .sort((a, b) => Number(b.value) - Number(a.value))
            .map((x) => ({ color: String(x.color ?? x.stroke), label: multi ? String(x.dataKey) : def.corto, value: def.fmt(Number(x.value)) }))} />
      ) : null}
    />
  )

  const ejes = (
    <>
      <CartesianGrid vertical={false} stroke={p.grid} />
      <XAxis dataKey="periodo" tickFormatter={fmtX} tick={tick(p.muted)} axisLine={{ stroke: p.axis }} tickLine={false} minTickGap={28} />
      <YAxis tick={tick(p.muted)} axisLine={false} tickLine={false} width={56} tickFormatter={def.eje}
        domain={def.aditiva ? [0, 'auto'] : ['auto', 'auto']} allowDecimals={metrica === 'calificacion'} />
    </>
  )

  return (
    <ChartCard kicker="Tendencia" title={<>{def.label} <span className="text-muted">por {grano === 'dia' ? 'día' : grano}</span></>}
      controls={controls} busy={q.isFetching}
      note={def.aditiva ? 'El primer y el último periodo pueden estar incompletos.' : 'Promedios calculados sobre los envíos de cada periodo; con granularidad diaria la serie es más volátil.'}
      rows={filas} cols={[
        { key: 'periodo', label: 'Periodo', fmt: fmtTitulo },
        ...(multi ? grupos : ['valor']).map((g) => ({ key: g, label: multi ? g : def.corto, fmt: (v: number | null) => v == null ? '—' : def.fmt(v), align: 'right' as const })),
      ]}>
      {multi && (
        <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2" aria-label="Leyenda">
          {grupos.map((g) => (
            <li key={g} className="flex items-center gap-1.5"><span className="h-0.5 w-3.5 rounded-full" style={{ background: color(g) }} />{g}</li>
          ))}
        </ul>
      )}
      <div className="h-[320px] w-full" role="img" aria-label={`${def.label} por ${grano}`}>
        <ResponsiveContainer>
          {multi ? (
            <LineChart data={filas} margin={{ top: 12, right: grupos.length <= 4 ? 96 : 16, left: 0, bottom: 0 }}>
              {ejes}{tooltip}
              {grupos.map((g) => (
                <Line key={g} dataKey={g} type="monotone" stroke={color(g)} strokeWidth={2} dot={false} connectNulls
                  activeDot={{ r: 4.5, stroke: p.surface, strokeWidth: 2 }} animationDuration={700}
                  label={grupos.length <= 4 ? (props: any) => props.index === filas.length - 1 && props.value != null ? (
                    <text x={props.x + 8} y={props.y} dominantBaseline="central" fontSize={11} fill={p.ink2}>{g}</text>
                  ) : <g /> : undefined} />
              ))}
            </LineChart>
          ) : (
            <AreaChart data={filas} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gEvo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={p.s[0]} stopOpacity={0.26} />
                  <stop offset="100%" stopColor={p.s[0]} stopOpacity={0} />
                </linearGradient>
              </defs>
              {ejes}{tooltip}
              <Area dataKey="valor" type="monotone" stroke={p.s[0]} strokeWidth={2} fill={def.aditiva ? 'url(#gEvo)' : 'none'}
                dot={false} activeDot={{ r: 5, stroke: p.surface, strokeWidth: 2 }} animationDuration={700}
                label={(props: any) => props.index === filas.length - 1 && ultimo ? (
                  <text x={props.x} y={props.y - 12} textAnchor="end" fontSize={11} fill={p.ink2}>{def.fmt(props.value)}</text>
                ) : <g />} />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}

function pivot(data: PuntoSerie[], metrica: Metrica, des: string | null) {
  const porPeriodo = new Map<string, Record<string, any>>()
  const set = new Set<string>()
  for (const d of data) {
    const fila = porPeriodo.get(d.periodo) ?? { periodo: d.periodo }
    const v = d[metrica]
    if (des) { fila[d.grupo ?? '—'] = v; set.add(d.grupo ?? '—') } else fila.valor = v
    porPeriodo.set(d.periodo, fila)
  }
  const orden = ORDEN_GRUPOS[des ?? ''] ?? []
  const grupos = [...set].sort((a, b) => (orden.indexOf(a) + 1 || 99) - (orden.indexOf(b) + 1 || 99))
  return { filas: [...porPeriodo.values()], grupos }
}
