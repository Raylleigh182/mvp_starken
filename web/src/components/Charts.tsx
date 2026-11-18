import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { usePaleta } from '../lib/theme'
import { Tip } from './Card'
import { fechaLarga, mesCorto, mesLargo, num, numCorto, pct, peso, pesoCorto } from '../lib/format'

const axisTick = (c: string) => ({ fill: c, fontSize: 11, fontFamily: 'Geist Mono Variable, monospace' })

/* ---------------- Pedidos por semana (línea + área suave) ---------------- */
export function WeeklyArea({ data }: { data: { semana: string; pedidos: number }[] }) {
  const p = usePaleta()
  const max = data.reduce((a, b) => (b.pedidos > a.pedidos ? b : a), data[0])
  return (
    <div className="h-[280px] w-full" role="img" aria-label="Pedidos por semana">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 24, right: 12, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={p.s[0]} stopOpacity={0.28} />
              <stop offset="100%" stopColor={p.s[0]} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={p.grid} />
          <XAxis dataKey="semana" tickFormatter={mesCorto} interval={3} tick={axisTick(p.muted)} axisLine={{ stroke: p.axis }} tickLine={false} minTickGap={12} />
          <YAxis tick={axisTick(p.muted)} axisLine={false} tickLine={false} width={44} tickFormatter={numCorto} domain={[0, 'auto']} />
          <Tooltip
            cursor={{ stroke: p.axis, strokeWidth: 1 }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <Tip title={`Semana del ${fechaLarga(payload[0].payload.semana)}`}
                  items={[{ color: p.s[0], label: 'Pedidos', value: num(payload[0].payload.pedidos) }]} />
              ) : null}
          />
          <Area type="monotone" dataKey="pedidos" stroke={p.s[0]} strokeWidth={2} fill="url(#gArea)"
            activeDot={{ r: 5, stroke: p.surface, strokeWidth: 2, fill: p.s[0] }} dot={false} animationDuration={900} />
          {max && (
            <ReferenceDot x={max.semana} y={max.pedidos} r={5} fill={p.s[0]} stroke={p.surface} strokeWidth={2}
              label={{ value: `máx. ${num(max.pedidos)}`, position: 'top', fill: p.ink2, fontSize: 11, offset: 10 }} />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ---------------- Ingresos por mes (barras) ---------------- */
export function MonthlyBars({ data }: { data: { mes: string; ingresos: number; pedidos: number }[] }) {
  const p = usePaleta()
  const ultimo = data[data.length - 1]
  return (
    <div className="h-[280px] w-full" role="img" aria-label="Ingresos por mes">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 24, right: 8, left: -4, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke={p.grid} />
          <XAxis dataKey="mes" tickFormatter={mesCorto} tick={axisTick(p.muted)} axisLine={{ stroke: p.axis }} tickLine={false} />
          <YAxis tick={axisTick(p.muted)} axisLine={false} tickLine={false} width={52} tickFormatter={(v) => pesoCorto(v).replace(' M', 'M')} />
          <Tooltip
            cursor={{ fill: p.grid, opacity: 0.5 }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <Tip title={mesLargo(payload[0].payload.mes)} items={[
                  { color: p.s[0], label: 'Ingresos', value: peso(payload[0].payload.ingresos) },
                  { label: 'Pedidos', value: num(payload[0].payload.pedidos) },
                ]} />
              ) : null}
          />
          <Bar dataKey="ingresos" fill={p.s[0]} radius={[4, 4, 0, 0]} animationDuration={900}>
            <LabelList dataKey="ingresos" position="top"
              content={(props: any) => props.index === data.length - 1 && ultimo ? (
                <text x={props.x + props.width / 2} y={props.y - 8} textAnchor="middle" fontSize={11} fill={p.ink2}>{pesoCorto(ultimo.ingresos)}</text>
              ) : null} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ---------------- Barras horizontales ordenadas ---------------- */
export function RankedBars<T extends { nombre: string }>({
  data, value, fmt, max, colorIndex = 0, labelAll = false, extra, referencia, valueLabel = 'Valor',
}: {
  data: T[]
  value: (d: T) => number | null
  fmt: (v: number) => string
  max?: number
  colorIndex?: number
  labelAll?: boolean
  extra?: (d: T) => { label: string; value: string }[]
  referencia?: { value: number; label: string } | null
  valueLabel?: string
}) {
  const p = usePaleta()
  const rows = data.map((d) => ({ ...d, _v: value(d) ?? 0 }))
  const h = Math.max(120, rows.length * 34 + 16)
  return (
    <div className="w-full" style={{ height: h }} role="img" aria-label="Ranking">
      <ResponsiveContainer>
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 64, left: 0, bottom: 0 }} barCategoryGap={6}>
          <XAxis type="number" hide domain={[0, max ?? 'dataMax']} />
          <YAxis type="category" dataKey="nombre" width={150} tick={{ fill: p.ink2, fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: p.grid, opacity: 0.45 }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <Tip title={payload[0].payload.nombre} items={[
                  { color: p.s[colorIndex], label: valueLabel, value: fmt(payload[0].payload._v) },
                  ...(extra ? extra(payload[0].payload) : []),
                ]} />
              ) : null}
          />
          {referencia && (
            <ReferenceLine x={referencia.value} stroke={p.ink2} strokeWidth={1} ifOverflow="extendDomain"
              label={{ value: referencia.label, position: 'insideTopRight', fill: p.ink2, fontSize: 10, offset: 4 }} />
          )}
          <Bar dataKey="_v" fill={p.s[colorIndex]} radius={[0, 4, 4, 0]} animationDuration={800}>
            <LabelList dataKey="_v" position="right"
              content={(props: any) => (labelAll || props.index === 0) ? (
                <text x={props.x + props.width + 8} y={props.y + props.height / 2} dominantBaseline="central" fontSize={12} fill={p.ink2} className="tabular">{fmt(props.value)}</text>
              ) : null} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ---------------- Barra segmentada (parte de un todo, ≤ 3 series) ---------------- */
export function SegmentedBar({ data }: { data: { nombre: string; pedidos: number; sla_pct: number | null; ingresos: number }[] }) {
  const p = usePaleta()
  const orden = ['Normal', 'Express', 'Mismo Día']
  const rows = orden.map((n) => data.find((d) => d.nombre === n)).filter(Boolean) as typeof data
  const total = rows.reduce((a, b) => a + b.pedidos, 0) || 1
  return (
    <div>
      <div className="flex h-16 w-full gap-[2px] overflow-hidden rounded-xl" role="img" aria-label="Mix por tipo de servicio">
        {rows.map((r) => {
          const share = (r.pedidos / total) * 100
          const color = p.s[orden.indexOf(r.nombre)]
          return (
            <div key={r.nombre} className="group/seg relative flex items-end p-2.5 transition-[flex-grow] duration-700"
              style={{ flexGrow: r.pedidos, flexBasis: 0, background: color }}
              title={`${r.nombre}: ${num(r.pedidos)} pedidos (${pct(share)})`}>
              {share > 9 && <span className="text-xs font-medium text-white">{pct(share)}</span>}
            </div>
          )
        })}
      </div>
      <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {rows.map((r) => (
          <li key={r.nombre} className="rounded-2xl border border-line p-3.5">
            <div className="flex items-center gap-2 text-sm text-ink">
              <span className="size-2.5 rounded-sm" style={{ background: p.s[orden.indexOf(r.nombre)] }} />
              {r.nombre}
            </div>
            <p className="mt-2 text-2xl font-medium tracking-tight text-ink">{num(r.pedidos)}</p>
            <p className="mt-0.5 text-xs text-muted">{pct((r.pedidos / total) * 100)} · SLA {pct(r.sla_pct)} · {pesoCorto(r.ingresos)}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---------------- Calificaciones 1-5 (rampa ordinal) ---------------- */
export function RatingBars({ data }: { data: { estrellas: number; pedidos: number }[] }) {
  const p = usePaleta()
  const total = data.reduce((a, b) => a + b.pedidos, 0) || 1
  return (
    <div className="h-[220px] w-full" role="img" aria-label="Distribución de calificaciones">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 22, right: 4, left: 4, bottom: 0 }} barCategoryGap="18%">
          <XAxis dataKey="estrellas" tickFormatter={(v) => `${v}★`} tick={axisTick(p.muted)} axisLine={{ stroke: p.axis }} tickLine={false} />
          <YAxis hide />
          <Tooltip cursor={{ fill: p.grid, opacity: 0.45 }}
            content={({ active, payload }) => active && payload?.length ? (
              <Tip title={`${payload[0].payload.estrellas} estrellas`} items={[
                { label: 'Pedidos', value: num(payload[0].payload.pedidos) },
                { label: 'Participación', value: pct((payload[0].payload.pedidos / total) * 100) },
              ]} />) : null} />
          <Bar dataKey="pedidos" radius={[4, 4, 0, 0]} animationDuration={800}>
            {data.map((d) => <Cell key={d.estrellas} fill={p.ordinal[d.estrellas - 1]} />)}
            <LabelList dataKey="pedidos" position="top"
              content={(props: any) => (
                <text x={props.x + props.width / 2} y={props.y - 7} textAnchor="middle" fontSize={11} fill={p.ink2}>{pct((props.value / total) * 100)}</text>
              )} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
