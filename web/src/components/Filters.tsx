import { RotateCcw, ChevronDown } from 'lucide-react'
import type { Filtros, Seleccion } from '../lib/api'
import { addDays } from '../lib/format'

export type Preset = 'todo' | '30' | '90' | 'mes' | 'custom'

export function rangoPreset(preset: Preset, f: Filtros): { desde: string | null; hasta: string | null } {
  const fin = f.fecha_max
  switch (preset) {
    case '30': return { desde: addDays(fin, -29), hasta: fin }
    case '90': return { desde: addDays(fin, -89), hasta: fin }
    case 'mes': return { desde: fin.slice(0, 8) + '01', hasta: fin }
    default: return { desde: null, hasta: null }
  }
}

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'todo', label: 'Todo 2026' },
  { id: '90', label: '90 días' },
  { id: '30', label: '30 días' },
  { id: 'mes', label: 'Mes en curso' },
]

export function FilterBar({
  filtros, sel, preset, onPreset, onChange, onReset, cargando,
}: {
  filtros: Filtros
  sel: Seleccion
  preset: Preset
  onPreset: (p: Preset) => void
  onChange: (s: Partial<Seleccion>) => void
  onReset: () => void
  cargando: boolean
}) {
  const activo = preset !== 'todo' || sel.region != null || sel.servicio != null || sel.canal != null
  return (
    <div className="sticky top-0 z-40 -mx-4 border-b border-line bg-page/80 px-4 py-3 backdrop-blur-xl sm:-mx-8 sm:px-8">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Periodo" className="flex rounded-full border border-line bg-surface p-1">
          {PRESETS.map((p) => (
            <button key={p.id} role="radio" aria-checked={preset === p.id} onClick={() => onPreset(p.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition sm:text-sm ${preset === p.id ? 'bg-ink text-page' : 'text-ink-2 hover:text-ink'}`}>
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-2 sm:text-sm">
          <input type="date" aria-label="Desde" className="bg-transparent text-ink outline-none"
            min={filtros.fecha_min} max={filtros.fecha_max}
            value={sel.desde ?? filtros.fecha_min}
            onChange={(e) => onChange({ desde: e.target.value || null })} />
          <span className="text-muted">→</span>
          <input type="date" aria-label="Hasta" className="bg-transparent text-ink outline-none"
            min={filtros.fecha_min} max={filtros.fecha_max}
            value={sel.hasta ?? filtros.fecha_max}
            onChange={(e) => onChange({ hasta: e.target.value || null })} />
        </div>

        <Select label="Región destino" value={sel.region} opciones={filtros.regiones} onChange={(v) => onChange({ region: v })} />
        <Select label="Servicio" value={sel.servicio} opciones={filtros.servicios} onChange={(v) => onChange({ servicio: v })} />
        <Select label="Canal" value={sel.canal} opciones={filtros.canales} onChange={(v) => onChange({ canal: v })} />

        {activo && (
          <button onClick={onReset} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-ink-2 transition hover:text-ink sm:text-sm">
            <RotateCcw size={14} /> Limpiar
          </button>
        )}
        <span aria-live="polite" className={`ml-auto flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted transition-opacity ${cargando ? 'opacity-100' : 'opacity-0'}`}>
          <span className="size-1.5 animate-pulse rounded-full bg-accent" /> Actualizando
        </span>
      </div>
    </div>
  )
}

function Select({ label, value, opciones, onChange }: {
  label: string; value: number | null; opciones: { id: number; nombre: string }[]; onChange: (v: number | null) => void
}) {
  return (
    <label className={`relative flex items-center rounded-full border bg-surface text-xs transition sm:text-sm ${value != null ? 'border-ink/40 text-ink' : 'border-line text-ink-2'}`}>
      <span className="sr-only">{label}</span>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="cursor-pointer appearance-none bg-transparent py-1.5 pr-8 pl-3 outline-none">
        <option value="">{label}: todas</option>
        {opciones.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-3 text-muted" />
    </label>
  )
}
