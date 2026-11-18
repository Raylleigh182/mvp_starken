import { useId, useRef, type KeyboardEvent } from 'react'
import { motion } from 'motion/react'
import { ChevronDown } from 'lucide-react'

type Opt<T extends string> = { value: T; label: string }

/** Control segmentado (radiogroup) con navegación por flechas y pastilla animada. */
export function Segmented<T extends string>({
  options, value, onChange, label, size = 'sm',
}: {
  options: Opt<T>[]
  value: T
  onChange: (v: T) => void
  label: string
  size?: 'sm' | 'xs'
}) {
  const id = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!d) return
    e.preventDefault()
    const n = (i + d + options.length) % options.length
    onChange(options[n].value)
    refs.current[n]?.focus()
  }
  const pad = size === 'xs' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-full border border-line bg-page p-0.5 [scrollbar-width:none]">
      {options.map((o, i) => {
        const on = o.value === value
        return (
          <button key={o.value} ref={(el) => { refs.current[i] = el }} role="radio" aria-checked={on} tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)} onKeyDown={(e) => onKey(e, i)}
            className={`relative shrink-0 whitespace-nowrap rounded-full font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent ${pad} ${on ? 'text-page' : 'text-ink-2 hover:text-ink'}`}>
            {on && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-full bg-ink" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Lista desplegable nativa (accesible) con estilo de pastilla y grupos opcionales. */
export function Dropdown({
  label, value, onChange, options, groups,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options?: Opt<string>[]
  groups?: { grupo: string; items: Opt<string>[] }[]
}) {
  return (
    <label className="relative inline-flex items-center rounded-full border border-line bg-page text-xs text-ink transition hover:border-ink/30">
      <span className="pl-3 text-muted">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none bg-transparent py-1.5 pr-8 pl-1.5 font-medium outline-none">
        {options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        {groups?.map((g) => (
          <optgroup key={g.grupo} label={g.grupo}>
            {g.items.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </optgroup>
        ))}
      </select>
      <ChevronDown size={13} className="pointer-events-none absolute right-2.5 text-muted" />
    </label>
  )
}
