import { createClient } from '@supabase/supabase-js'

// Clave "publishable": pensada para ir en el navegador. Solo puede ejecutar
// las funciones públicas de agregados; las tablas están bloqueadas por RLS.
const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

export const supabase = createClient(url, key, { auth: { persistSession: false } })

export type Opcion = { id: number; nombre: string; zona?: string }
export type Filtros = {
  regiones: Opcion[]
  servicios: Opcion[]
  canales: Opcion[]
  fecha_min: string
  fecha_max: string
}

export type Seleccion = {
  desde: string | null
  hasta: string | null
  region: number | null
  servicio: number | null
  canal: number | null
}

type Fila = { nombre: string; pedidos: number }
export type Dashboard = {
  kpis: {
    pedidos: number
    ingresos: number
    ticket_promedio: number | null
    sla_pct: number | null
    incidencias_pct: number | null
    calificacion: number | null
    dias_transito: number | null
    kg_facturados: number
    en_curso: number
  }
  semanal: { semana: string; pedidos: number; ingresos: number; sla_pct: number | null }[]
  mensual: { mes: string; pedidos: number; ingresos: number }[]
  estados: (Fila & { final: boolean })[]
  regiones: (Fila & { zona: string; ingresos: number; sla_pct: number | null })[]
  zonas: (Fila & { sla_pct: number | null; dias: number | null })[]
  servicios: (Fila & { ingresos: number; sla_pct: number | null })[]
  canales: (Fila & { ingresos: number })[]
  contenidos: Fila[]
  incidencias: Fila[]
  calificaciones: { estrellas: number; pedidos: number }[]
  sucursales: (Fila & { ingresos: number; sla_pct: number | null })[]
}

export type Rastreo = {
  id_pedido: string
  codigo_seguimiento: number
  emitido_en: string
  estado: string
  es_final: boolean
  servicio: string
  origen: string
  sucursal_origen: string
  destino: string
  tipo_entrega: string
  sucursal_destino: string | null
  n_bultos: number
  fecha_comprometida: string
  fecha_entrega_real: string | null
  intentos_entrega: number
  motivo_incidencia: string | null
  cumple_sla: boolean | null
}

export async function getFiltros(): Promise<Filtros> {
  const { data, error } = await supabase.rpc('dashboard_filtros')
  if (error) throw error
  return data as Filtros
}

export async function getDashboard(s: Seleccion): Promise<Dashboard> {
  const { data, error } = await supabase.rpc('dashboard', {
    p_desde: s.desde,
    p_hasta: s.hasta,
    p_region: s.region,
    p_servicio: s.servicio,
    p_canal: s.canal,
  })
  if (error) throw error
  return data as Dashboard
}

export async function rastrear(codigo: string): Promise<Rastreo | null> {
  const { data, error } = await supabase.rpc('rastrear_envio', { p_codigo: Number(codigo) })
  if (error) throw error
  return (data as Rastreo | null) ?? null
}
