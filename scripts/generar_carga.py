"""
Genera archivos SQL de carga para Supabase a partir del Excel de pedidos.

Uso:
    python scripts/generar_carga.py <ruta_excel> [carpeta_salida]

Salida (por defecto carga/, ignorada por git):
    01_catalogos.sql   geografía, catálogos, clientes, rutas, conductores, parámetros
    02_pedidos_XX.sql  pedidos en bloques de 2.000 filas
Cada archivo es una transacción independiente e idempotente
(ON CONFLICT DO NOTHING), así que se puede re-ejecutar sin duplicar.
"""
import sys
from pathlib import Path

import pandas as pd

EXCEL = Path(sys.argv[1])
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("carga")
CHUNK = 2000
ESTADOS_FINALES = {"Entregado", "Devuelto a Origen", "Siniestrado"}


def q(v):
    """Literal SQL seguro."""
    if v is None or (isinstance(v, float) and pd.isna(v)) or v is pd.NaT:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int,)) or (hasattr(v, "dtype") and str(getattr(v, "dtype", "")).startswith("int")):
        return str(int(v))
    if isinstance(v, float):
        return repr(round(v, 2))
    return "'" + str(v).replace("'", "''") + "'"


def ids(values):
    """Asigna ids 1..n en orden alfabético estable."""
    return {v: i for i, v in enumerate(sorted(set(values)), start=1)}


def insert(table, cols, rows, conflict):
    if not rows:
        return ""
    body = ",\n".join("(" + ",".join(q(x) for x in r) + ")" for r in rows)
    ov = " overriding system value" if cols[0] == "id" else ""
    return (f"insert into public.{table} ({','.join(cols)}){ov} values\n{body}\n"
            f"on conflict ({conflict}) do nothing;\n\n")


df = pd.read_excel(EXCEL, sheet_name="Pedidos")
df["emitido_en"] = pd.to_datetime(df["Fecha Emisión"].dt.strftime("%Y-%m-%d") + " " + df["Hora Emisión"].astype(str))
df = df.sort_values("emitido_en")

# ---------------- Geografía ----------------
geo = pd.concat([
    df[["Comuna Origen", "Región Origen"]].set_axis(["comuna", "region"], axis=1),
    df[["Comuna Destino", "Región Destino"]].set_axis(["comuna", "region"], axis=1),
]).drop_duplicates()
assert geo["comuna"].is_unique, "Una comuna aparece en más de una región"
zona = df.groupby("Región Destino")["Zona Destino"].first().to_dict()

rc = df["Ruta / Conductor"].str.split(" / ", expand=True)
df["ruta"], df["conductor"] = rc[0], rc[1]
prefijo = (df.dropna(subset=["ruta"]).assign(p=lambda d: d["ruta"].str[:3])
           .groupby("Región Destino")["p"].first().to_dict())

region_id = ids(geo["region"])
comuna_id = ids(geo["comuna"])
comuna_region = dict(zip(geo["comuna"], geo["region"]))
suc = pd.concat([
    df[["Sucursal Origen", "Comuna Origen"]].set_axis(["s", "c"], axis=1),
    df.dropna(subset=["Sucursal Destino"])[["Sucursal Destino", "Comuna Destino"]].set_axis(["s", "c"], axis=1),
]).drop_duplicates()
assert suc["s"].is_unique, "Una sucursal aparece en más de una comuna"
sucursal_id = ids(suc["s"])
sucursal_comuna = dict(zip(suc["s"], suc["c"]))

# ---------------- Catálogos ----------------
CATS = {
    "canal_venta": "Canal de Venta", "tipo_cliente": "Tipo Cliente",
    "tipo_servicio": "Tipo Servicio", "tipo_bulto": "Tipo Bulto",
    "contenido": "Contenido Declarado", "condicion_pago": "Condición de Pago",
    "medio_pago": "Medio de Pago", "motivo_incidencia": "Motivo Incidencia",
    "estado_pedido": "Estado",
}
cat_id = {t: ids(df[c].dropna()) for t, c in CATS.items()}

# ---------------- Clientes (nombre del pedido más reciente) ----------------
rem = df[["emitido_en", "RUT Remitente", "Nombre Remitente", "Tipo Cliente"]].set_axis(["t", "rut", "nombre", "tipo"], axis=1)
des = df[["emitido_en", "RUT Destinatario", "Nombre Destinatario"]].set_axis(["t", "rut", "nombre"], axis=1)
nombres = pd.concat([rem[["t", "rut", "nombre"]], des]).sort_values("t").groupby("rut")["nombre"].last()
tipos = rem.sort_values("t").groupby("rut")["tipo"].last()

# ---------------- Archivo 1: dimensiones ----------------
OUT.mkdir(parents=True, exist_ok=True)
s = ["begin;\n\n"]
s.append(insert("region", ["id", "nombre", "zona", "prefijo_ruta"],
                [(i, r, zona[r], prefijo.get(r)) for r, i in region_id.items()], "id"))
s.append(insert("comuna", ["id", "nombre", "region_id"],
                [(i, c, region_id[comuna_region[c]]) for c, i in comuna_id.items()], "id"))
s.append(insert("sucursal", ["id", "nombre", "comuna_id"],
                [(i, n, comuna_id[sucursal_comuna[n]]) for n, i in sucursal_id.items()], "id"))
for t, m in cat_id.items():
    if t == "estado_pedido":
        s.append(insert(t, ["id", "nombre", "es_final"], [(i, n, n in ESTADOS_FINALES) for n, i in m.items()], "id"))
    else:
        s.append(insert(t, ["id", "nombre"], [(i, n) for n, i in m.items()], "id"))
s.append(insert("cliente", ["rut", "nombre", "tipo_cliente_id"],
                [(r, n, cat_id["tipo_cliente"].get(tipos.get(r))) for r, n in nombres.items()], "rut"))
rutas = df.dropna(subset=["ruta"]).groupby("ruta")["Región Destino"].agg(lambda x: x.mode()[0])
s.append(insert("ruta", ["codigo", "region_id"], [(r, region_id[g]) for r, g in rutas.items()], "codigo"))
s.append(insert("conductor", ["codigo"], [(c,) for c in sorted(df["conductor"].dropna().unique())], "codigo"))

sup = pd.read_excel(EXCEL, sheet_name="Supuestos", header=None)
params = {"IVA": "iva", "Factor peso volumétrico (cm³/kg)": "factor_peso_volumetrico",
          "Tasa seguro sobre valor declarado": "tasa_seguro", "Cobro mínimo seguro (CLP)": "seguro_minimo_clp"}
prow = [(params[r[1]], float(r[2]), r[1]) for r in sup.itertuples(index=False) if r[1] in params]
s.append(insert("parametro", ["clave", "valor", "descripcion"], prow, "clave"))

# reajustar secuencias identity tras insertar ids explícitos
for t in ["region", "comuna", "sucursal", *cat_id]:
    s.append(f"select setval(pg_get_serial_sequence('public.{t}','id'), (select max(id) from public.{t}));\n")
s.append("\ncommit;\n")
(OUT / "01_catalogos.sql").write_text("".join(s), encoding="utf-8")

# ---------------- Archivos 2..n: pedidos ----------------
COLS = ["id_pedido", "codigo_seguimiento", "emitido_en", "canal_venta_id", "remitente_rut", "remitente_telefono",
        "sucursal_origen_id", "destinatario_rut", "destinatario_telefono", "destinatario_email", "direccion_destino",
        "comuna_destino_id", "entrega_domicilio", "sucursal_destino_id", "tipo_servicio_id", "tipo_bulto_id",
        "contenido_id", "n_bultos", "peso_real_kg", "largo_cm", "ancho_cm", "alto_cm", "peso_volumetrico_kg",
        "peso_facturable_kg", "valor_declarado", "seguro_contratado", "condicion_pago_id", "medio_pago_id",
        "flete_neto", "costo_seguro", "total_neto", "iva", "total_con_iva", "fecha_comprometida",
        "fecha_entrega_real", "estado_id", "intentos_entrega", "motivo_incidencia_id", "recibido_por",
        "ruta_codigo", "conductor_codigo", "dias_transito", "cumple_sla", "calificacion"]


def fecha(v):
    return None if pd.isna(v) else v.strftime("%Y-%m-%d")


def entero(v):
    return None if pd.isna(v) else int(v)


rows = []
for r in df.sort_values("ID Pedido").itertuples(index=False):
    c = dict(zip(df.columns, r))
    rows.append((
        c["ID Pedido"], int(c["Código Seguimiento"]), c["emitido_en"].strftime("%Y-%m-%d %H:%M:%S"),
        cat_id["canal_venta"][c["Canal de Venta"]], c["RUT Remitente"], c["Teléfono Remitente"],
        sucursal_id[c["Sucursal Origen"]], c["RUT Destinatario"], c["Teléfono Destinatario"],
        c["Email Destinatario"], c["Dirección Destino"], comuna_id[c["Comuna Destino"]],
        c["Tipo Entrega"] == "Domicilio",
        None if pd.isna(c["Sucursal Destino"]) else sucursal_id[c["Sucursal Destino"]],
        cat_id["tipo_servicio"][c["Tipo Servicio"]], cat_id["tipo_bulto"][c["Tipo Bulto"]],
        cat_id["contenido"][c["Contenido Declarado"]], int(c["N° Bultos"]), float(c["Peso Real (kg)"]),
        int(c["Largo (cm)"]), int(c["Ancho (cm)"]), int(c["Alto (cm)"]), float(c["Peso Volumétrico (kg)"]),
        float(c["Peso Facturable (kg)"]), int(c["Valor Declarado (CLP)"]), c["Seguro Contratado"] == "Sí",
        cat_id["condicion_pago"][c["Condición de Pago"]], cat_id["medio_pago"][c["Medio de Pago"]],
        int(c["Flete Neto (CLP)"]), int(c["Costo Seguro (CLP)"]), int(c["Total Neto (CLP)"]),
        int(c["IVA (CLP)"]), int(c["Total con IVA (CLP)"]), fecha(c["Fecha Comprometida"]),
        fecha(c["Fecha Entrega Real"]), cat_id["estado_pedido"][c["Estado"]], int(c["Intentos de Entrega"]),
        None if pd.isna(c["Motivo Incidencia"]) else cat_id["motivo_incidencia"][c["Motivo Incidencia"]],
        None if pd.isna(c["Recibido Por"]) else c["Recibido Por"],
        None if pd.isna(c["ruta"]) else c["ruta"], None if pd.isna(c["conductor"]) else c["conductor"],
        entero(c["Días Tránsito (hábiles)"]),
        {"Sí": True, "No": False}.get(c["Cumple SLA"]), entero(c["Calificación Cliente (1-5)"]),
    ))

n_files = 0
for k in range(0, len(rows), CHUNK):
    n_files += 1
    sql = "begin;\n\n" + insert("pedido", COLS, rows[k:k + CHUNK], "id_pedido") + "commit;\n"
    (OUT / f"02_pedidos_{n_files:02d}.sql").write_text(sql, encoding="utf-8")

print(f"regiones={len(region_id)} comunas={len(comuna_id)} sucursales={len(sucursal_id)} "
      f"clientes={len(nombres)} rutas={len(rutas)} conductores={df['conductor'].nunique()} "
      f"pedidos={len(rows)} archivos_pedidos={n_files}")
