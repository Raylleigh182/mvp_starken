-- =====================================================================
-- MVP Starken - Modelo de datos inicial (PROPUESTA, aún no aplicada)
-- Origen: Book1.xlsx, hoja "Pedidos" (10.000 filas x 51 columnas)
--         y hoja "Supuestos" (parámetros de cálculo)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Geografía y red de sucursales
--    Zona depende de la región; región depende de la comuna;
--    cada sucursal pertenece a una comuna ("Starken <Comuna>").
-- ---------------------------------------------------------------------
create table region (
  id      smallint generated always as identity primary key,
  nombre  text not null unique,
  zona    text not null check (zona in ('Norte','Centro','Sur','Austral')),
  prefijo_ruta char(3)            -- ej. MET, BIO (Los Lagos y Los Ríos comparten LOS)
);

create table comuna (
  id        smallint generated always as identity primary key,
  nombre    text not null unique,
  region_id smallint not null references region(id)
);

create table sucursal (
  id        smallint generated always as identity primary key,
  nombre    text not null unique,
  comuna_id smallint not null references comuna(id)
);

-- ---------------------------------------------------------------------
-- 2. Catálogos (valores cerrados del Excel)
-- ---------------------------------------------------------------------
create table canal_venta       (id smallint generated always as identity primary key, nombre text not null unique);
create table tipo_cliente      (id smallint generated always as identity primary key, nombre text not null unique);
create table tipo_servicio     (id smallint generated always as identity primary key, nombre text not null unique);
create table tipo_bulto        (id smallint generated always as identity primary key, nombre text not null unique);
create table contenido         (id smallint generated always as identity primary key, nombre text not null unique);
create table condicion_pago    (id smallint generated always as identity primary key, nombre text not null unique);
create table medio_pago        (id smallint generated always as identity primary key, nombre text not null unique);
create table motivo_incidencia (id smallint generated always as identity primary key, nombre text not null unique);
create table estado_pedido (
  id       smallint generated always as identity primary key,
  nombre   text not null unique,
  es_final boolean not null default false   -- Entregado, Devuelto a Origen, Siniestrado
);

-- ---------------------------------------------------------------------
-- 3. Clientes (remitentes y destinatarios), identificados por RUT
--    tipo_cliente solo se conoce para remitentes.
--    Teléfono / email / dirección se guardan en el pedido (varían por envío).
-- ---------------------------------------------------------------------
create table cliente (
  rut             text primary key check (rut ~ '^[0-9]{7,8}-[0-9K]$'),
  nombre          text not null,
  tipo_cliente_id smallint references tipo_cliente(id)
);

-- ---------------------------------------------------------------------
-- 4. Operación de última milla (solo pedidos a domicilio)
--    Ruta y conductor son N:M -> se registran ambos en el pedido.
-- ---------------------------------------------------------------------
create table ruta (
  codigo    text primary key check (codigo ~ '^[A-Z]{3}-[0-9]{3}$'),
  region_id smallint references region(id)
);

create table conductor (
  codigo text primary key check (codigo ~ '^CND-[0-9]{4}$')
);

-- ---------------------------------------------------------------------
-- 5. Pedido (tabla de hechos, 1 fila por envío)
-- ---------------------------------------------------------------------
create table pedido (
  id_pedido            text primary key check (id_pedido ~ '^PED-[0-9]{4}-[0-9]{6}$'),
  codigo_seguimiento   bigint not null unique,
  emitido_en           timestamp not null,               -- Fecha + Hora Emisión (hora local Chile)
  canal_venta_id       smallint not null references canal_venta(id),

  -- Origen
  remitente_rut        text not null references cliente(rut),
  remitente_telefono   text,
  sucursal_origen_id   smallint not null references sucursal(id),

  -- Destino
  destinatario_rut     text not null references cliente(rut),
  destinatario_telefono text,
  destinatario_email   text,
  direccion_destino    text not null,
  comuna_destino_id    smallint not null references comuna(id),
  entrega_domicilio    boolean not null,                 -- false = Retiro en Sucursal
  sucursal_destino_id  smallint references sucursal(id),
  constraint chk_sucursal_destino check (entrega_domicilio = (sucursal_destino_id is null)),

  -- Carga
  tipo_servicio_id     smallint not null references tipo_servicio(id),
  tipo_bulto_id        smallint not null references tipo_bulto(id),
  contenido_id         smallint not null references contenido(id),
  n_bultos             smallint not null check (n_bultos > 0),
  peso_real_kg         numeric(8,2) not null,
  largo_cm             smallint not null,
  ancho_cm             smallint not null,
  alto_cm              smallint not null,
  peso_volumetrico_kg  numeric(8,2) not null,            -- L*A*H/4000 * n_bultos
  peso_facturable_kg   numeric(8,2) not null,            -- max(real, volumétrico)

  -- Valorización (CLP)
  valor_declarado      integer not null default 0,
  seguro_contratado    boolean not null,
  condicion_pago_id    smallint not null references condicion_pago(id),
  medio_pago_id        smallint not null references medio_pago(id),
  flete_neto           integer not null,
  costo_seguro         integer not null,
  total_neto           integer not null,
  iva                  integer not null,
  total_con_iva        integer not null,
  constraint chk_totales check (total_neto = flete_neto + costo_seguro
                                and total_con_iva = total_neto + iva),

  -- Seguimiento y entrega
  fecha_comprometida   date not null,
  fecha_entrega_real   date,
  estado_id            smallint not null references estado_pedido(id),
  intentos_entrega     smallint not null default 0,
  motivo_incidencia_id smallint references motivo_incidencia(id),
  recibido_por         text,
  ruta_codigo          text references ruta(codigo),
  conductor_codigo     text references conductor(codigo),
  dias_transito        smallint,                         -- días hábiles
  cumple_sla           boolean,                          -- null = Pendiente
  calificacion         smallint check (calificacion between 1 and 5)
);

create index on pedido (emitido_en);
create index on pedido (estado_id);
create index on pedido (remitente_rut);
create index on pedido (destinatario_rut);
create index on pedido (sucursal_origen_id);
create index on pedido (comuna_destino_id);

-- ---------------------------------------------------------------------
-- 6. Parámetros de cálculo (hoja "Supuestos")
-- ---------------------------------------------------------------------
create table parametro (
  clave       text primary key,
  valor       numeric not null,
  descripcion text
);

-- ---------------------------------------------------------------------
-- 7. Vista plana equivalente al Excel (para reportes / Power BI)
-- ---------------------------------------------------------------------
create view v_pedido as
select p.id_pedido, p.codigo_seguimiento, p.emitido_en,
       cv.nombre  as canal_venta,
       tc.nombre  as tipo_cliente,
       p.remitente_rut, cr.nombre as remitente_nombre,
       so.nombre  as sucursal_origen, co.nombre as comuna_origen, ro.nombre as region_origen,
       p.destinatario_rut, cd.nombre as destinatario_nombre,
       cmd.nombre as comuna_destino, rd.nombre as region_destino, rd.zona as zona_destino,
       case when p.entrega_domicilio then 'Domicilio' else 'Retiro en Sucursal' end as tipo_entrega,
       sd.nombre  as sucursal_destino,
       ts.nombre  as tipo_servicio, tb.nombre as tipo_bulto, ct.nombre as contenido,
       p.n_bultos, p.peso_real_kg, p.peso_volumetrico_kg, p.peso_facturable_kg,
       p.valor_declarado, p.seguro_contratado,
       cp.nombre  as condicion_pago, mp.nombre as medio_pago,
       p.flete_neto, p.costo_seguro, p.total_neto, p.iva, p.total_con_iva,
       p.fecha_comprometida, p.fecha_entrega_real,
       ep.nombre  as estado, p.intentos_entrega, mi.nombre as motivo_incidencia,
       p.recibido_por, p.ruta_codigo, p.conductor_codigo,
       p.dias_transito, p.cumple_sla, p.calificacion
from pedido p
join canal_venta cv        on cv.id  = p.canal_venta_id
join cliente cr            on cr.rut = p.remitente_rut
left join tipo_cliente tc  on tc.id  = cr.tipo_cliente_id
join sucursal so           on so.id  = p.sucursal_origen_id
join comuna co             on co.id  = so.comuna_id
join region ro             on ro.id  = co.region_id
join cliente cd            on cd.rut = p.destinatario_rut
join comuna cmd            on cmd.id = p.comuna_destino_id
join region rd             on rd.id  = cmd.region_id
left join sucursal sd      on sd.id  = p.sucursal_destino_id
join tipo_servicio ts      on ts.id  = p.tipo_servicio_id
join tipo_bulto tb         on tb.id  = p.tipo_bulto_id
join contenido ct          on ct.id  = p.contenido_id
join condicion_pago cp     on cp.id  = p.condicion_pago_id
join medio_pago mp         on mp.id  = p.medio_pago_id
join estado_pedido ep      on ep.id  = p.estado_id
left join motivo_incidencia mi on mi.id = p.motivo_incidencia_id;

-- ---------------------------------------------------------------------
-- 8. Seguridad: RLS activo en todas las tablas (sin políticas = nadie
--    accede con la clave publishable hasta que definamos políticas).
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['region','comuna','sucursal','canal_venta','tipo_cliente',
    'tipo_servicio','tipo_bulto','contenido','condicion_pago','medio_pago',
    'motivo_incidencia','estado_pedido','cliente','ruta','conductor','pedido','parametro']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

alter view v_pedido set (security_invoker = true);
