-- =====================================================================
-- API de exploración del dashboard (selectores de métrica / dimensión)
-- Todas las funciones devuelven solo agregados. Las columnas dinámicas
-- se eligen desde listas blancas, nunca desde texto libre.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Base filtrada y enriquecida (interna: no expuesta al público)
-- ---------------------------------------------------------------------
create or replace function public._dash_base(
  p_desde date, p_hasta date, p_region smallint, p_servicio smallint, p_canal smallint
)
returns table (
  emitido_en timestamp, total_con_iva integer, cumple_sla boolean, calificacion smallint,
  dias_transito smallint, con_incidencia boolean, peso_facturable_kg numeric,
  region_destino text, zona_destino text, region_origen text, zona_origen text,
  servicio text, canal text, contenido text, estado text, motivo text, sucursal_origen text,
  tipo_bulto text, tipo_entrega text, medio_pago text, condicion_pago text, tipo_cliente text
)
language sql stable security definer
set search_path = public
as $$
  select p.emitido_en, p.total_con_iva, p.cumple_sla, p.calificacion, p.dias_transito,
         p.motivo_incidencia_id is not null, p.peso_facturable_kg,
         rd.nombre, rd.zona, ro.nombre, ro.zona,
         ts.nombre, cv.nombre, ct.nombre, ep.nombre, mi.nombre, so.nombre,
         tb.nombre, case when p.entrega_domicilio then 'Domicilio' else 'Retiro en Sucursal' end,
         mp.nombre, cp.nombre, coalesce(tc.nombre, 'Sin tipo')
  from pedido p
  join comuna cd          on cd.id = p.comuna_destino_id
  join region rd          on rd.id = cd.region_id
  join sucursal so        on so.id = p.sucursal_origen_id
  join comuna co          on co.id = so.comuna_id
  join region ro          on ro.id = co.region_id
  join tipo_servicio ts   on ts.id = p.tipo_servicio_id
  join canal_venta cv     on cv.id = p.canal_venta_id
  join contenido ct       on ct.id = p.contenido_id
  join estado_pedido ep   on ep.id = p.estado_id
  join tipo_bulto tb      on tb.id = p.tipo_bulto_id
  join medio_pago mp      on mp.id = p.medio_pago_id
  join condicion_pago cp  on cp.id = p.condicion_pago_id
  join cliente cr         on cr.rut = p.remitente_rut
  left join tipo_cliente tc      on tc.id = cr.tipo_cliente_id
  left join motivo_incidencia mi on mi.id = p.motivo_incidencia_id
  where (p_desde    is null or p.emitido_en >= p_desde)
    and (p_hasta    is null or p.emitido_en <  p_hasta + 1)
    and (p_region   is null or cd.region_id = p_region)
    and (p_servicio is null or p.tipo_servicio_id = p_servicio)
    and (p_canal    is null or p.canal_venta_id = p_canal);
$$;
revoke all on function public._dash_base(date, date, smallint, smallint, smallint) from public, anon, authenticated;

-- Columna permitida para agrupar (lista blanca)
create or replace function public._dash_columna(p text)
returns text language sql immutable
as $$
  select case p
    when 'region_destino'  then 'region_destino'
    when 'zona_destino'    then 'zona_destino'
    when 'region_origen'   then 'region_origen'
    when 'zona_origen'     then 'zona_origen'
    when 'servicio'        then 'servicio'
    when 'canal'           then 'canal'
    when 'contenido'       then 'contenido'
    when 'estado'          then 'estado'
    when 'motivo'          then 'motivo'
    when 'sucursal_origen' then 'sucursal_origen'
    when 'tipo_bulto'      then 'tipo_bulto'
    when 'tipo_entrega'    then 'tipo_entrega'
    when 'medio_pago'      then 'medio_pago'
    when 'condicion_pago'  then 'condicion_pago'
    when 'tipo_cliente'    then 'tipo_cliente'
  end;
$$;
revoke all on function public._dash_columna(text) from public, anon, authenticated;

-- Métricas estándar (mismo texto en todas las consultas)
-- pedidos, ingresos, ticket, sla_pct, incidencias_pct, calificacion, dias

-- ---------------------------------------------------------------------
-- KPIs (para comparar contra el periodo anterior)
-- ---------------------------------------------------------------------
create or replace function public.dashboard_kpis(
  p_desde date default null, p_hasta date default null,
  p_region smallint default null, p_servicio smallint default null, p_canal smallint default null
)
returns jsonb language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'pedidos',         count(*),
    'ingresos',        coalesce(sum(total_con_iva), 0),
    'ticket_promedio', round(avg(total_con_iva)),
    'sla_pct',         round(100.0 * count(*) filter (where cumple_sla) / nullif(count(cumple_sla), 0), 1),
    'incidencias_pct', round(100.0 * count(*) filter (where con_incidencia) / nullif(count(*), 0), 1),
    'calificacion',    round(avg(calificacion), 2),
    'dias_transito',   round(avg(dias_transito), 2)
  )
  from public._dash_base(p_desde, p_hasta, p_region, p_servicio, p_canal);
$$;

-- ---------------------------------------------------------------------
-- Serie temporal con granularidad y desglose opcional
-- ---------------------------------------------------------------------
create or replace function public.dashboard_serie(
  p_desde date default null, p_hasta date default null,
  p_region smallint default null, p_servicio smallint default null, p_canal smallint default null,
  p_grano text default 'semana', p_desglose text default null
)
returns jsonb language plpgsql stable security definer
set search_path = public
as $$
declare
  g text := case p_grano when 'dia' then 'day' when 'mes' then 'month' else 'week' end;
  col text := case when p_desglose in ('servicio', 'zona_destino', 'tipo_entrega', 'canal', 'tipo_cliente')
                   then public._dash_columna(p_desglose) end;
  r jsonb;
begin
  if p_desglose is not null and col is null then
    raise exception 'Desglose no permitido: %', p_desglose;
  end if;
  execute format($q$
    with b as (select * from public._dash_base($1, $2, $3, $4, $5)),
         m as (select min(emitido_en)::date d from b)
    select coalesce(jsonb_agg(to_jsonb(s) order by s.periodo, s.grupo), '[]'::jsonb)
    from (
      select greatest(date_trunc(%L, b.emitido_en)::date, m.d) as periodo,
             %s as grupo,
             count(*) as pedidos,
             sum(total_con_iva) as ingresos,
             round(avg(total_con_iva)) as ticket,
             round(100.0 * count(*) filter (where cumple_sla) / nullif(count(cumple_sla), 0), 1) as sla_pct,
             round(100.0 * count(*) filter (where con_incidencia) / count(*), 1) as incidencias_pct,
             round(avg(calificacion), 2) as calificacion
      from b, m
      group by 1, 2
    ) s
  $q$, g, coalesce(quote_ident(col), 'null::text'))
  into r using p_desde, p_hasta, p_region, p_servicio, p_canal;
  return r;
end;
$$;

-- ---------------------------------------------------------------------
-- Desglose por cualquier dimensión permitida
-- ---------------------------------------------------------------------
create or replace function public.dashboard_desglose(
  p_desde date default null, p_hasta date default null,
  p_region smallint default null, p_servicio smallint default null, p_canal smallint default null,
  p_dimension text default 'region_destino'
)
returns jsonb language plpgsql stable security definer
set search_path = public
as $$
declare
  col text := public._dash_columna(p_dimension);
  r jsonb;
begin
  if col is null then raise exception 'Dimensión no permitida: %', p_dimension; end if;
  execute format($q$
    select coalesce(jsonb_agg(to_jsonb(s) order by s.pedidos desc), '[]'::jsonb)
    from (
      select coalesce(%I, 'Sin incidencia') as nombre,
             count(*) as pedidos,
             sum(total_con_iva) as ingresos,
             round(avg(total_con_iva)) as ticket,
             round(100.0 * count(*) filter (where cumple_sla) / nullif(count(cumple_sla), 0), 1) as sla_pct,
             round(100.0 * count(*) filter (where con_incidencia) / count(*), 1) as incidencias_pct,
             round(avg(calificacion), 2) as calificacion,
             round(avg(dias_transito), 2) as dias
      from public._dash_base($1, $2, $3, $4, $5)
      group by 1
    ) s
  $q$, col)
  into r using p_desde, p_hasta, p_region, p_servicio, p_canal;
  return r;
end;
$$;

-- ---------------------------------------------------------------------
-- Matriz para mapa de calor
--   dia_hora       : día de semana (1-7) x hora de emisión
--   zonas          : zona origen x zona destino
--   servicio_zona  : servicio x zona destino
-- ---------------------------------------------------------------------
create or replace function public.dashboard_matriz(
  p_desde date default null, p_hasta date default null,
  p_region smallint default null, p_servicio smallint default null, p_canal smallint default null,
  p_tipo text default 'dia_hora'
)
returns jsonb language plpgsql stable security definer
set search_path = public
as $$
declare
  fx text; fy text; r jsonb;
begin
  case p_tipo
    when 'dia_hora'      then fx := 'extract(hour from emitido_en)::int::text'; fy := 'extract(isodow from emitido_en)::int::text';
    when 'zonas'         then fx := 'zona_destino';  fy := 'zona_origen';
    when 'servicio_zona' then fx := 'zona_destino';  fy := 'servicio';
    else raise exception 'Matriz no permitida: %', p_tipo;
  end case;
  execute format($q$
    select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
    from (
      select %s as x, %s as y,
             count(*) as pedidos,
             sum(total_con_iva) as ingresos,
             round(avg(total_con_iva)) as ticket,
             round(100.0 * count(*) filter (where cumple_sla) / nullif(count(cumple_sla), 0), 1) as sla_pct,
             round(100.0 * count(*) filter (where con_incidencia) / count(*), 1) as incidencias_pct,
             round(avg(calificacion), 2) as calificacion
      from public._dash_base($1, $2, $3, $4, $5)
      group by 1, 2
    ) s
  $q$, fx, fy)
  into r using p_desde, p_hasta, p_region, p_servicio, p_canal;
  return r;
end;
$$;

-- ---------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------
revoke all on function public.dashboard_kpis(date, date, smallint, smallint, smallint) from public;
revoke all on function public.dashboard_serie(date, date, smallint, smallint, smallint, text, text) from public;
revoke all on function public.dashboard_desglose(date, date, smallint, smallint, smallint, text) from public;
revoke all on function public.dashboard_matriz(date, date, smallint, smallint, smallint, text) from public;
grant execute on function public.dashboard_kpis(date, date, smallint, smallint, smallint) to anon, authenticated;
grant execute on function public.dashboard_serie(date, date, smallint, smallint, smallint, text, text) to anon, authenticated;
grant execute on function public.dashboard_desglose(date, date, smallint, smallint, smallint, text) to anon, authenticated;
grant execute on function public.dashboard_matriz(date, date, smallint, smallint, smallint, text) to anon, authenticated;
