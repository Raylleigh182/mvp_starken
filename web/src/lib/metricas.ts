import { dec, num, numCorto, pct, peso, pesoCorto } from './format'

export type ClaveMetrica = 'pedidos' | 'ingresos' | 'ticket' | 'sla_pct' | 'incidencias_pct' | 'calificacion' | 'dias'

export type DefMetrica = {
  label: string
  corto: string
  fmt: (v: number) => string
  eje: (v: number) => string
  /** true = suma (volumen); false = promedio o tasa */
  aditiva: boolean
  /** dirección deseable */
  mejor: 'arriba' | 'abajo'
  max?: number
}

export const METRICAS: Record<ClaveMetrica, DefMetrica> = {
  pedidos:         { label: 'Pedidos', corto: 'Pedidos', fmt: num, eje: numCorto, aditiva: true, mejor: 'arriba' },
  ingresos:        { label: 'Ingresos con IVA', corto: 'Ingresos', fmt: pesoCorto, eje: (v) => pesoCorto(v).replace(' M', 'M').replace(' mil', 'k'), aditiva: true, mejor: 'arriba' },
  ticket:          { label: 'Ticket promedio', corto: 'Ticket', fmt: peso, eje: (v) => pesoCorto(v).replace(' mil', 'k'), aditiva: false, mejor: 'arriba' },
  sla_pct:         { label: 'Cumplimiento SLA', corto: 'SLA', fmt: pct, eje: (v) => `${v}%`, aditiva: false, mejor: 'arriba', max: 100 },
  incidencias_pct: { label: 'Tasa de incidencia', corto: 'Incidencias', fmt: pct, eje: (v) => `${v}%`, aditiva: false, mejor: 'abajo' },
  calificacion:    { label: 'Calificación promedio', corto: 'Calificación', fmt: dec, eje: dec, aditiva: false, mejor: 'arriba', max: 5 },
  dias:            { label: 'Días hábiles en tránsito', corto: 'Días tránsito', fmt: dec, eje: dec, aditiva: false, mejor: 'abajo' },
}

export const opcionesMetrica = (claves: ClaveMetrica[]) =>
  claves.map((k) => ({ value: k, label: METRICAS[k].corto }))

export const DIMENSIONES = [
  { grupo: 'Geografía', items: [
    { value: 'region_destino', label: 'Región de destino' },
    { value: 'zona_destino', label: 'Zona de destino' },
    { value: 'region_origen', label: 'Región de origen' },
    { value: 'sucursal_origen', label: 'Sucursal de origen' },
  ] },
  { grupo: 'Comercial', items: [
    { value: 'canal', label: 'Canal de venta' },
    { value: 'tipo_cliente', label: 'Tipo de cliente' },
    { value: 'servicio', label: 'Tipo de servicio' },
    { value: 'medio_pago', label: 'Medio de pago' },
    { value: 'condicion_pago', label: 'Condición de pago' },
  ] },
  { grupo: 'Operación', items: [
    { value: 'estado', label: 'Estado del envío' },
    { value: 'motivo', label: 'Motivo de incidencia' },
    { value: 'tipo_entrega', label: 'Tipo de entrega' },
    { value: 'contenido', label: 'Contenido declarado' },
    { value: 'tipo_bulto', label: 'Tipo de bulto' },
  ] },
]

/** Orden fijo por entidad: el color sigue a la entidad, nunca al ranking. */
export const ORDEN_GRUPOS: Record<string, string[]> = {
  servicio: ['Normal', 'Express', 'Mismo Día'],
  zona_destino: ['Centro', 'Sur', 'Norte', 'Austral'],
  tipo_entrega: ['Domicilio', 'Retiro en Sucursal'],
  canal: ['Sucursal', 'Web', 'Cuenta Corporativa', 'Integración API', 'App'],
  tipo_cliente: ['Persona', 'PYME', 'E-commerce', 'Empresa'],
}
