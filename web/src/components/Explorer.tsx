import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react'
import { getDesglose, type Kpis, type Seleccion } from '../lib/api'
import { DIMENSIONES, METRICAS, opcionesMetrica, type ClaveMetrica } from '../lib/metricas'
import { num, pct, pesoCorto, dec } from '../lib/format'
import { ChartCard } from './Card'
import { RankedBars } from './Charts'
import { Dropdown, Segmented } from './Selectors'

const MIN_ENVIOS = 30
const etiquetaDim = (v: string) => DIMENSIONES.flatMap((g) => g.items).find((i) => i.value === v)?.label ?? v

export function Explorer({ sel, kpis }: { sel: Seleccion; kpis: Kpis | undefined }) {
  const [dim, setDim] = useState('region_destino')
  const [metrica, setMetrica] = useState<ClaveMetrica>('pedidos')
  const [asc, setAsc] = useState(false)
  const [top, setTop] = useState<'10' | 'todos'>('10')
  const def = METRICAS[metrica]

  const q = useQuery({
    queryKey: ['desglose', sel, dim],
    queryFn: () => getDesglose(sel, dim),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

  const { filas, total, omitidos } = useMemo(() => {
    const base = (q.data ?? []).map((r) => ({ ...r, nombre: r.nombre.replace(/^Starken /, '') }))
    const validos = def.aditiva ? base : base.filter((r) => r.pedidos >= MIN_ENVIOS && r[metrica] != null)
    const orden = [...validos].sort((a, b) => ((a[metrica] ?? 0) - (b[metrica] ?? 0)) * (asc ? 1 : -1))
    return { filas: top === '10' ? orden.slice(0, 10) : orden, total: base.length, omitidos: base.length - validos.length }
  }, [q.data, metrica, asc, top, def.aditiva])

  const general = !def.aditiva && kpis ? {
    ticket: kpis.ticket_promedio, sla_pct: kpis.sla_pct, incidencias_pct: kpis.incidencias_pct,
    calificacion: kpis.calificacion, dias: kpis.dias_transito,
  }[metrica as 'ticket'] : null

  const controls = (
    <>
      <Dropdown label="Ver por" value={dim} onChange={setDim} groups={DIMENSIONES} />
      <Segmented size="xs" label="Métrica" value={metrica} onChange={setMetrica}
        options={opcionesMetrica(['pedidos', 'ingresos', 'ticket', 'sla_pct', 'incidencias_pct', 'calificacion', 'dias'])} />
      <button onClick={() => setAsc((v) => !v)} aria-label={asc ? 'Orden ascendente' : 'Orden descendente'} title={asc ? 'Menor a mayor' : 'Mayor a menor'}
        className="grid size-7 place-items-center rounded-full border border-line bg-page text-ink-2 transition hover:text-ink">
        {asc ? <ArrowUpNarrowWide size={14} /> : <ArrowDownWideNarrow size={14} />}
      </button>
      {total > 10 && (
        <Segmented size="xs" label="Cantidad" value={top} onChange={setTop}
          options={[{ value: '10', label: 'Top 10' }, { value: 'todos', label: `Todos (${total})` }]} />
      )}
    </>
  )

  return (
    <ChartCard kicker="Explorador" title={<>{def.label} <span className="text-muted">por {etiquetaDim(dim).toLowerCase()}</span></>}
      controls={controls} busy={q.isFetching}
      note={!def.aditiva ? `La línea vertical marca el valor general. ${omitidos > 0 ? `${omitidos} grupo(s) con menos de ${MIN_ENVIOS} envíos se omiten.` : ''}` : undefined}
      rows={filas} cols={[
        { key: 'nombre', label: etiquetaDim(dim) },
        { key: 'pedidos', label: 'Pedidos', fmt: num, align: 'right' },
        { key: 'ingresos', label: 'Ingresos', fmt: pesoCorto, align: 'right' },
        { key: 'sla_pct', label: 'SLA', fmt: pct, align: 'right' },
        { key: 'incidencias_pct', label: 'Incid.', fmt: pct, align: 'right' },
        { key: 'calificacion', label: 'Calif.', fmt: dec, align: 'right' },
      ]}>
      {filas.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">Sin datos suficientes para esta combinación.</p>
      ) : (
        <RankedBars key={`${dim}-${metrica}`} data={filas} value={(r) => r[metrica]} fmt={def.fmt} max={def.max}
          valueLabel={def.corto} labelAll={filas.length <= 6}
          referencia={general != null ? { value: general, label: `General ${def.fmt(general)}` } : null}
          extra={(r) => [
            ...(metrica !== 'pedidos' ? [{ label: 'Pedidos', value: num(r.pedidos) }] : []),
            ...(metrica !== 'sla_pct' ? [{ label: 'SLA', value: pct(r.sla_pct) }] : []),
            ...(metrica !== 'ingresos' ? [{ label: 'Ingresos', value: pesoCorto(r.ingresos) }] : []),
          ]} />
      )}
    </ChartCard>
  )
}
