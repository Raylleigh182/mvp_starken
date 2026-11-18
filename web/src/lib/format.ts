const nf = new Intl.NumberFormat('es-CL')
const nf1 = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
const clp = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })

export const num = (v: number | null | undefined) => (v == null ? '—' : nf.format(v))
export const dec = (v: number | null | undefined) => (v == null ? '—' : nf1.format(v))
export const pct = (v: number | null | undefined) => (v == null ? '—' : `${nf1.format(v)}%`)
export const peso = (v: number | null | undefined) => (v == null ? '—' : clp.format(v))

/** $271,3 M  ·  $27,1 mil */
export function pesoCorto(v: number | null | undefined) {
  if (v == null) return '—'
  if (Math.abs(v) >= 1e9) return `$${nf1.format(v / 1e9)} mil M`
  if (Math.abs(v) >= 1e6) return `$${nf1.format(v / 1e6)} M`
  if (Math.abs(v) >= 1e3) return `$${nf1.format(v / 1e3)} mil`
  return clp.format(v)
}

export function numCorto(v: number) {
  if (Math.abs(v) >= 1e6) return `${nf1.format(v / 1e6)} M`
  if (Math.abs(v) >= 1e3) return `${nf1.format(v / 1e3)} k`
  return nf.format(v)
}

const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const d = (iso: string) => {
  const [y, m, day] = iso.slice(0, 10).split('-').map(Number)
  return { y, m, day }
}
export const fechaCorta = (iso: string) => { const x = d(iso); return `${x.day} ${meses[x.m - 1]}` }
export const fechaLarga = (iso: string) => { const x = d(iso); return `${x.day} ${meses[x.m - 1]} ${x.y}` }
export const mesCorto = (iso: string) => meses[d(iso).m - 1]
export const mesLargo = (iso: string) => {
  const x = d(iso)
  const n = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  return `${n[x.m - 1]} ${x.y}`
}

export function addDays(iso: string, n: number) {
  const t = new Date(iso + 'T00:00:00Z')
  t.setUTCDate(t.getUTCDate() + n)
  return t.toISOString().slice(0, 10)
}
