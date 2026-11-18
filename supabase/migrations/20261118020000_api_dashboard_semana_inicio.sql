-- =====================================================================
-- API pública del dashboard (solo agregados, sin datos personales)
-- Las tablas siguen bloqueadas por RLS; el rol anon solo puede ejecutar
-- estas funciones, que devuelven conteos, sumas y promedios.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Opciones de filtros
-- ---------------------------------------------------------------------
create or replace function public.dashboard_filtros()
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'regiones',  (select jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre, 'zona', zona) order by nombre) from region),
    'servicios', (select jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre) order by nombre) from tipo_servicio),
    'canales',   (select jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre) order by nombre) from canal_venta),
    'fecha_min', (select min(emitido_en)::date from pedido),
    'fecha_max', (select max(emitido_en)::date from pedido)
  );
$$;

-- ---------------------------------------------------------------------
-- Agregados del dashboard, con filtros opcionales (null = todos)
-- ---------------------------------------------------------------------
create or replace function public.dashboard(
  p_desde    date     default null,
  p_hasta    date     default null,
  p_region   smallint default null,   -- región de destino
  p_servicio smallint default null,
  p_canal    smallint default null
)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  with f as (
    select p.*, cm.region_id as region_destino_id, r.nombre as region_destino, r.zona,
           ep.nombre as estado, ep.es_final
    from pedido p
    join comuna cm        on cm.id = p.comuna_destino_id
    join region r         on r.id  = cm.region_id
    join estado_pedido ep on ep.id = p.estado_id
    where (p_desde    is null or p.emitido_en >= p_desde)
      and (p_hasta    is null or p.emitido_en <  p_hasta + 1)
      and (p_region   is null or cm.region_id = p_region)
      and (p_servicio is null or p.tipo_servicio_id = p_servicio)
      and (p_canal    is null or p.canal_venta_id = p_canal)
  )
  select jsonb_build_object(
    'kpis', (
      select jsonb_build_object(
        'pedidos',            count(*),
        'ingresos',           coalesce(sum(total_con_iva), 0),
        'ticket_promedio',    round(avg(total_con_iva)),
        'sla_pct',            round(100.0 * count(*) filter (where cumple_sla) / nullif(count(cumple_sla), 0), 1),
        'incidencias_pct',    round(100.0 * count(motivo_incidencia_id) / nullif(count(*), 0), 1),
        'calificacion',       round(avg(calificacion), 2),
        'dias_transito',      round(avg(dias_transito), 2),
        'kg_facturados',      round(coalesce(sum(peso_facturable_kg), 0)),
        'en_curso',           count(*) filter (where not es_final)
      ) from f
    ),
    'semanal', coalesce((
      select jsonb_agg(jsonb_build_object('semana', semana, 'pedidos', n, 'ingresos', ingresos, 'sla_pct', sla) order by semana)
      from (
        select greatest(date_trunc('week', emitido_en)::date, (select min(emitido_en)::date from f)) as semana,
               count(*) n, sum(total_con_iva) ingresos,
               round(100.0 * count(*) filter (where cumple_sla) / nullif(count(cumple_sla), 0), 1) sla
        from f group by 1
      ) s
    ), '[]'::jsonb),
    'mensual', coalesce((
      select jsonb_agg(jsonb_build_object('mes', mes, 'pedidos', n, 'ingresos', ingresos) order by mes)
      from (select date_trunc('month', emitido_en)::date mes, count(*) n, sum(total_con_iva) ingresos from f group by 1) s
    ), '[]'::jsonb),
    'estados', coalesce((
      select jsonb_agg(jsonb_build_object('nombre', estado, 'pedidos', n, 'final', es_final) order by n desc)
      from (select estado, es_final, count(*) n from f group by 1, 2) s
    ), '[]'::jsonb),
    'regiones', coalesce((
      select jsonb_agg(jsonb_build_object('nombre', region_destino, 'zona', zona, 'pedidos', n, 'ingresos', ingresos, 'sla_pct', sla) order by n desc)
      from (
        select region_destino, zona, count(*) n, sum(total_con_iva) ingresos,
               round(100.0 * count(*) filter (where cumple_sla) / nullif(count(cumple_sla), 0), 1) sla
        from f group by 1, 2
      ) s
    ), '[]'::jsonb),
    'zonas', coalesce((
      select jsonb_agg(jsonb_build_object('nombre', zona, 'pedidos', n, 'sla_pct', sla, 'dias', dias) order by n desc)
      from (
        select zona, count(*) n,
               round(100.0 * count(*) filter (where cumple_sla) / nullif(count(cumple_sla), 0), 1) sla,
               round(avg(dias_transito), 2) dias
        from f group by 1
      ) s
    ), '[]'::jsonb),
    'servicios', coalesce((
      select jsonb_agg(jsonb_build_object('nombre', ts.nombre, 'pedidos', n, 'ingresos', ingresos, 'sla_pct', sla) order by n desc)
      from (
        select tipo_servicio_id, count(*) n, sum(total_con_iva) ingresos,
               round(100.0 * count(*) filter (where cumple_sla) / nullif(count(cumple_sla), 0), 1) sla
        from f group by 1
      ) s join tipo_servicio ts on ts.id = s.tipo_servicio_id
    ), '[]'::jsonb),
    'canales', coalesce((
      select jsonb_agg(jsonb_build_object('nombre', cv.nombre, 'pedidos', n, 'ingresos', ingresos) order by n desc)
      from (select canal_venta_id, count(*) n, sum(total_con_iva) ingresos from f group by 1) s
      join canal_venta cv on cv.id = s.canal_venta_id
    ), '[]'::jsonb),
    'contenidos', coalesce((
      select jsonb_agg(jsonb_build_object('nombre', c.nombre, 'pedidos', n) order by n desc)
      from (select contenido_id, count(*) n from f group by 1) s
      join contenido c on c.id = s.contenido_id
    ), '[]'::jsonb),
    'incidencias', coalesce((
      select jsonb_agg(jsonb_build_object('nombre', mi.nombre, 'pedidos', n) order by n desc)
      from (select motivo_incidencia_id, count(*) n from f where motivo_incidencia_id is not null group by 1) s
      join motivo_incidencia mi on mi.id = s.motivo_incidencia_id
    ), '[]'::jsonb),
    'calificaciones', coalesce((
      select jsonb_agg(jsonb_build_object('estrellas', calificacion, 'pedidos', n) order by calificacion)
      from (select calificacion, count(*) n from f where calificacion is not null group by 1) s
    ), '[]'::jsonb),
    'sucursales', coalesce((
      select jsonb_agg(jsonb_build_object('nombre', su.nombre, 'pedidos', n, 'ingresos', ingresos, 'sla_pct', sla) order by n desc)
      from (
        select sucursal_origen_id, count(*) n, sum(total_con_iva) ingresos,
               round(100.0 * count(*) filter (where cumple_sla) / nullif(count(cumple_sla), 0), 1) sla
        from f group by 1 order by 2 desc limit 10
      ) s join sucursal su on su.id = s.sucursal_origen_id
    ), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------
-- Rastreo público por código de seguimiento (sin datos personales)
-- ---------------------------------------------------------------------
create or replace function public.rastrear_envio(p_codigo bigint)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id_pedido',          p.id_pedido,
    'codigo_seguimiento', p.codigo_seguimiento,
    'emitido_en',         p.emitido_en,
    'estado',             ep.nombre,
    'es_final',           ep.es_final,
    'servicio',           ts.nombre,
    'origen',             co.nombre || ', ' || ro.nombre,
    'sucursal_origen',    so.nombre,
    'destino',            cd.nombre || ', ' || rd.nombre,
    'tipo_entrega',       case when p.entrega_domicilio then 'Domicilio' else 'Retiro en Sucursal' end,
    'sucursal_destino',   sd.nombre,
    'n_bultos',           p.n_bultos,
    'fecha_comprometida', p.fecha_comprometida,
    'fecha_entrega_real', p.fecha_entrega_real,
    'intentos_entrega',   p.intentos_entrega,
    'motivo_incidencia',  mi.nombre,
    'cumple_sla',         p.cumple_sla
  )
  from pedido p
  join estado_pedido ep  on ep.id = p.estado_id
  join tipo_servicio ts  on ts.id = p.tipo_servicio_id
  join sucursal so       on so.id = p.sucursal_origen_id
  join comuna co         on co.id = so.comuna_id
  join region ro         on ro.id = co.region_id
  join comuna cd         on cd.id = p.comuna_destino_id
  join region rd         on rd.id = cd.region_id
  left join sucursal sd  on sd.id = p.sucursal_destino_id
  left join motivo_incidencia mi on mi.id = p.motivo_incidencia_id
  where p.codigo_seguimiento = p_codigo;
$$;

-- ---------------------------------------------------------------------
-- Permisos: solo estas funciones quedan expuestas al público
-- ---------------------------------------------------------------------
revoke all on function public.dashboard_filtros() from public;
revoke all on function public.dashboard(date, date, smallint, smallint, smallint) from public;
revoke all on function public.rastrear_envio(bigint) from public;
grant execute on function public.dashboard_filtros() to anon, authenticated;
grant execute on function public.dashboard(date, date, smallint, smallint, smallint) to anon, authenticated;
grant execute on function public.rastrear_envio(bigint) to anon, authenticated;
