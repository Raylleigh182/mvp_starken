import { useState, type ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, CheckCircle2, AlertTriangle, Clock, PackageSearch, XCircle } from 'lucide-react'
import { rastrear, type Rastreo } from '../lib/api'
import { fechaLarga, num } from '../lib/format'

const EJEMPLOS = ['7504627410', '6733456515', '6275314641']

function estadoInfo(r: Rastreo) {
  if (r.estado === 'Entregado') return { Icon: CheckCircle2, cls: 'text-[#006300] dark:text-[#0ca30c]', label: 'Entregado' }
  if (r.estado === 'Siniestrado') return { Icon: XCircle, cls: 'text-[#d03b3b]', label: r.estado }
  if (r.estado === 'Con Incidencia' || r.estado === 'Devuelto a Origen') return { Icon: AlertTriangle, cls: 'text-[#c46a3c] dark:text-[#ec835a]', label: r.estado }
  return { Icon: Clock, cls: 'text-ink', label: r.estado }
}

export function Tracker() {
  const [codigo, setCodigo] = useState('')
  const m = useMutation({ mutationFn: rastrear })
  const valido = /^\d{10}$/.test(codigo)

  const buscar = (c: string) => { setCodigo(c); if (/^\d{10}$/.test(c)) m.mutate(c) }

  return (
    <section id="rastreo" className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6 sm:p-10">
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-24 size-96 rounded-full blur-3xl" style={{ background: 'var(--glow-2)' }} />
      <div className="relative grid gap-8 lg:grid-cols-2">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Consulta pública</p>
          <h2 className="mt-3 text-4xl font-semibold leading-[0.95] tracking-[-0.035em] text-ink sm:text-5xl">Rastrea un envío.</h2>
          <p className="mt-4 max-w-md text-sm text-ink-2">Ingresa el código de seguimiento de 10 dígitos. Solo mostramos el estado y el trayecto, nunca datos personales.</p>
          <form className="mt-6 flex max-w-md items-center gap-2 rounded-full border border-line bg-page p-1.5 focus-within:border-ink/40"
            onSubmit={(e) => { e.preventDefault(); if (valido) m.mutate(codigo) }}>
            <PackageSearch size={18} className="ml-3 shrink-0 text-muted" />
            <input inputMode="numeric" autoComplete="off" placeholder="Ej. 7504627410" aria-label="Código de seguimiento"
              value={codigo} maxLength={10} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
              className="tabular min-w-0 flex-1 bg-transparent px-1 py-2 text-base text-ink outline-none placeholder:text-muted" />
            <button type="submit" disabled={!valido || m.isPending}
              className="flex items-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-page transition hover:opacity-90 disabled:opacity-40">
              {m.isPending ? 'Buscando…' : 'Rastrear'} <ArrowRight size={15} />
            </button>
          </form>
          <p className="mt-3 text-xs text-muted">
            Prueba con:{' '}
            {EJEMPLOS.map((c, i) => (
              <button key={c} onClick={() => buscar(c)} className="tabular underline decoration-line underline-offset-4 hover:text-ink">
                {c}{i < EJEMPLOS.length - 1 ? ',' : ''}
              </button>
            )).reduce<ReactNode[]>((a, b) => [...a, ' ', b], [])}
          </p>
        </div>

        <div className="min-h-[220px]" aria-live="polite">
          <AnimatePresence mode="wait">
            {m.isError && (
              <motion.p key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-ink-2">
                No pudimos consultar el envío. Intenta de nuevo.
              </motion.p>
            )}
            {m.isSuccess && !m.data && (
              <motion.div key="none" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="rounded-2xl border border-dashed border-line p-6 text-sm text-ink-2">
                No encontramos un envío con el código <span className="tabular text-ink">{m.variables}</span>.
              </motion.div>
            )}
            {m.data && <Resultado key={m.data.id_pedido} r={m.data} />}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}

function Resultado({ r }: { r: Rastreo }) {
  const { Icon, cls, label } = estadoInfo(r)
  const pasos = [
    { t: 'Emitido', d: fechaLarga(r.emitido_en), ok: true },
    { t: 'Comprometido', d: fechaLarga(r.fecha_comprometida), ok: true },
    { t: r.fecha_entrega_real ? 'Entregado' : 'Entrega pendiente', d: r.fecha_entrega_real ? fechaLarga(r.fecha_entrega_real) : '—', ok: !!r.fecha_entrega_real },
  ]
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.4 }}
      className="rounded-2xl border border-line bg-page p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className={`flex items-center gap-2 text-lg font-medium ${cls}`}><Icon size={20} /> {label}</span>
        <span className="tabular font-mono text-xs text-muted">{r.id_pedido}</span>
      </div>
      <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm">
        <div><p className="text-xs text-muted">Origen</p><p className="mt-0.5 text-ink">{r.origen}</p></div>
        <ArrowRight size={16} className="text-muted" />
        <div><p className="text-xs text-muted">Destino</p><p className="mt-0.5 text-ink">{r.destino}</p></div>
      </div>
      <ol className="mt-6 grid grid-cols-3 gap-2">
        {pasos.map((p) => (
          <li key={p.t} className="border-t-2 pt-2" style={{ borderColor: p.ok ? 'var(--ink)' : 'var(--line)' }}>
            <p className="text-xs text-ink">{p.t}</p>
            <p className="tabular text-xs text-muted">{p.d}</p>
          </li>
        ))}
      </ol>
      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
        <div><dt className="text-muted">Servicio</dt><dd className="text-ink">{r.servicio}</dd></div>
        <div><dt className="text-muted">Entrega</dt><dd className="text-ink">{r.tipo_entrega}</dd></div>
        <div><dt className="text-muted">Bultos</dt><dd className="text-ink">{num(r.n_bultos)}</dd></div>
        <div><dt className="text-muted">Intentos</dt><dd className="text-ink">{num(r.intentos_entrega)}</dd></div>
      </dl>
      {r.motivo_incidencia && (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink-2">
          <AlertTriangle size={14} /> Incidencia: {r.motivo_incidencia}
        </p>
      )}
    </motion.div>
  )
}
