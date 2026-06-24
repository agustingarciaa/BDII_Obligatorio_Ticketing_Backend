/**
 * Seed masivo — genera un gran volumen de datos para pruebas.
 *
 * Inserta (todo respetando las constraints del modelo):
 *   equipos, estadios + sectores, admins, funcionarios + dispositivos,
 *   clientes, partidos (mezcla de pasados y futuros, sin solapamiento por estadio),
 *   sector-partido habilitados con costo, ventas + entradas (máx 5 por venta,
 *   sin superar la capacidad), transferencias, asignaciones funcionario-sector,
 *   y validaciones de entradas de partidos pasados.
 *
 * Temático del Mundial 2026: selecciones reales, sedes en USA/Canadá/México con
 * estadios y ciudades reales, y un administrador por país anfitrión.
 *
 * Es idempotente: al arrancar borra los datos generados por una corrida previa
 * (usuarios con mail 'bulk_%' y los estadios/partidos creados por un admin bulk)
 * y NO toca datos reales cargados a mano.
 *
 * Todos los usuarios generados tienen contraseña: Password123
 *
 * Uso:   node scripts/seed-masivo.mjs
 * Volúmenes configurables por env (defaults entre paréntesis):
 *   BULK_CLIENTES (300)  BULK_FUNCIONARIOS (16)  BULK_ESTADIOS (16)  BULK_PARTIDOS (48)
 *   BULK_MAX_VENDIDAS_POR_SECTOR (60)   ← tope de entradas vendidas por sector-partido
 * Conexión a la DB por env (igual que el otro script):
 *   DB_HOST (127.0.0.1)  DB_PORT (3307)  DB_USER (root)  DB_PASSWORD (root_pass)  DB_NAME (ticketing_db)
 */

import mysql from "mysql2/promise";
import bcrypt from "bcrypt";

// ── Config ───────────────────────────────────────────────────────────────────
const DB = {
  host: process.env.DB_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 3307),
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "root_pass",
  database: process.env.DB_NAME ?? "ticketing_db",
  multipleStatements: true,
};
const N_CLIENTES = Number(process.env.BULK_CLIENTES ?? 300);
const N_FUNCIONARIOS = Number(process.env.BULK_FUNCIONARIOS ?? 16);
const N_PARTIDOS = Number(process.env.BULK_PARTIDOS ?? 48);
const MAX_VENDIDAS_SECTOR = Number(process.env.BULK_MAX_VENDIDAS_POR_SECTOR ?? 60);
const PASSWORD = "Password123";

// ── Temática Mundial 2026 (sedes en USA, Canadá y México) ────────────────────
// Selecciones participantes (FK EQUIPO.pais). Incluye a los 3 anfitriones.
const SELECCIONES = [
  "Estados Unidos", "México", "Canadá", "Argentina", "Brasil", "Uruguay",
  "Francia", "Inglaterra", "España", "Alemania", "Portugal", "Países Bajos",
  "Italia", "Bélgica", "Croacia", "Japón", "Corea del Sur", "Marruecos",
  "Senegal", "Australia", "Suiza", "Dinamarca", "Colombia", "Ecuador",
  "Perú", "Chile", "Paraguay", "Polonia", "Serbia", "Austria", "Ucrania",
  "Nigeria", "Ghana", "Camerún", "Costa de Marfil", "Egipto", "Túnez",
  "Argelia", "Catar", "Irán", "Arabia Saudita", "Costa Rica", "Panamá",
  "Jamaica", "Escocia", "Suecia", "Noruega", "Turquía",
];

// Países anfitriones (jurisdicciones de los administradores).
const HOSTS = ["Estados Unidos", "Canadá", "México"];

// 16 sedes reales del Mundial 2026 (nombre, país anfitrión, ciudad).
const SEDES = [
  { nombre: "MetLife Stadium", pais: "Estados Unidos", ciudad: "Nueva York/Nueva Jersey" },
  { nombre: "AT&T Stadium", pais: "Estados Unidos", ciudad: "Dallas" },
  { nombre: "NRG Stadium", pais: "Estados Unidos", ciudad: "Houston" },
  { nombre: "Mercedes-Benz Stadium", pais: "Estados Unidos", ciudad: "Atlanta" },
  { nombre: "Hard Rock Stadium", pais: "Estados Unidos", ciudad: "Miami" },
  { nombre: "Lincoln Financial Field", pais: "Estados Unidos", ciudad: "Filadelfia" },
  { nombre: "Gillette Stadium", pais: "Estados Unidos", ciudad: "Boston" },
  { nombre: "Levi's Stadium", pais: "Estados Unidos", ciudad: "San Francisco" },
  { nombre: "SoFi Stadium", pais: "Estados Unidos", ciudad: "Los Ángeles" },
  { nombre: "Lumen Field", pais: "Estados Unidos", ciudad: "Seattle" },
  { nombre: "Arrowhead Stadium", pais: "Estados Unidos", ciudad: "Kansas City" },
  { nombre: "BMO Field", pais: "Canadá", ciudad: "Toronto" },
  { nombre: "BC Place", pais: "Canadá", ciudad: "Vancouver" },
  { nombre: "Estadio Azteca", pais: "México", ciudad: "Ciudad de México" },
  { nombre: "Estadio Akron", pais: "México", ciudad: "Guadalajara" },
  { nombre: "Estadio BBVA", pais: "México", ciudad: "Monterrey" },
];
const N_ESTADIOS = Math.min(Number(process.env.BULK_ESTADIOS ?? SEDES.length), SEDES.length);

// Sectores por estadio (modelo: A, B, C, D)
const SECTORES = [
  { n: "A", cap: 20000 }, { n: "B", cap: 15000 },
  { n: "C", cap: 10000 }, { n: "D", cap: 8000 },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
function pad(n, w = 6) { return String(n).padStart(w, "0"); }
function fechaSlot(dayOffset) {
  const d = new Date();
  d.setHours(18, 0, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString().slice(0, 19).replace("T", " ");
}
async function batch(table, cols, rows, chunk = 500) {
  let n = 0;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const ph = slice.map(() => `(${cols.map(() => "?").join(",")})`).join(",");
    await q(`INSERT INTO ${table} (${cols.join(",")}) VALUES ${ph}`, slice.flat());
    n += slice.length;
  }
  return n;
}

const t0 = Date.now();
const db = await mysql.createConnection(DB);
const q = async (sql, params = []) => (await db.query(sql, params))[0];

// ── Cleanup de corridas previas ──────────────────────────────────────────────
// Identifica lo generado por: usuarios con mail 'bulk_%' y estadios cuyos
// partidos fueron creados por un admin bulk. No toca datos cargados a mano.
async function limpiarBulk() {
  const bulkUser = `(SELECT id_usuario FROM USUARIO WHERE mail LIKE 'bulk_%')`;
  // Resolver los estadios bulk una sola vez (antes de borrar los partidos).
  // Incluye el marcador viejo (ciudad='BULKSEED') por compatibilidad con corridas previas.
  const estRows = await q(
    `SELECT id_estadio FROM ESTADIO WHERE ciudad = 'BULKSEED'
     UNION
     SELECT DISTINCT id_estadio FROM PARTIDO
     WHERE admin_id_usuario IN (SELECT id_usuario FROM USUARIO WHERE mail LIKE 'bulk_admin%')`,
  );
  const inEst = estRows.length ? `(${estRows.map((r) => r.id_estadio).join(",")})` : "(NULL)";

  const stmts = [
    `DELETE FROM VALIDACION WHERE funcionario_id_usuario IN ${bulkUser} OR id_boleto IN (SELECT id_boleto FROM ENTRADA WHERE sectorpartido_id_estadio IN ${inEst})`,
    `DELETE FROM TRANSFERENCIA WHERE origen_id_usuario IN ${bulkUser} OR destino_id_usuario IN ${bulkUser} OR entrada_id_boleto IN (SELECT id_boleto FROM ENTRADA WHERE sectorpartido_id_estadio IN ${inEst})`,
    `DELETE FROM ENTRADA WHERE sectorpartido_id_estadio IN ${inEst} OR venta_id_venta IN (SELECT id_venta FROM VENTA WHERE id_usuario IN ${bulkUser})`,
    `DELETE FROM FUNCIONARIO_SECTOR_PARTIDO WHERE sectorpartido_id_estadio IN ${inEst} OR funcionario_id_usuario IN ${bulkUser}`,
    `DELETE FROM SECTOR_PARTIDO WHERE sector_id_estadio IN ${inEst}`,
    `DELETE FROM VENTA WHERE id_usuario IN ${bulkUser}`,
    `DELETE FROM DISPOSITIVO WHERE fun_id_usuario IN ${bulkUser}`,
    `DELETE FROM PARTIDO WHERE id_estadio IN ${inEst} OR admin_id_usuario IN ${bulkUser}`,
    `DELETE FROM SECTOR WHERE id_estadio IN ${inEst}`,
    `DELETE FROM ESTADIO WHERE id_estadio IN ${inEst}`,
    `DELETE FROM FUNCIONARIO_VALIDACION WHERE id_usuario IN ${bulkUser}`,
    `DELETE FROM ADMIN_POR_SEDE WHERE id_usuario IN ${bulkUser}`,
    `DELETE FROM USUARIO_GENERAL WHERE id_usuario IN ${bulkUser}`,
    `DELETE FROM TELEFONO_USUARIO WHERE id_usuario IN ${bulkUser}`,
    `DELETE FROM USUARIO WHERE mail LIKE 'bulk_%'`,
  ];
  for (const s of stmts) await q(s);
}

try {
  console.log(`Conectado a ${DB.user}@${DB.host}:${DB.port}/${DB.database}`);

  // Guarda para uso automático en Docker: si ya hay datos bulk, no re-seedea.
  if (process.env.SEED_SKIP_IF_EXISTS === "1") {
    const [ya] = await q("SELECT COUNT(*) AS n FROM USUARIO WHERE mail LIKE 'bulk_%'");
    if (Number(ya.n) > 0) {
      console.log("Ya existen datos bulk — se saltea el seed (SEED_SKIP_IF_EXISTS=1).");
      await db.end();
      process.exit(0);
    }
  }

  console.log("Limpiando datos de corridas previas (bulk)…");
  await limpiarBulk();

  const hash = await bcrypt.hash(PASSWORD, 10);

  // ── EQUIPOS = selecciones del Mundial (compartidos, no se borran) ──────────
  await q(
    `INSERT IGNORE INTO EQUIPO (pais) VALUES ${SELECCIONES.map(() => "(?)").join(",")}`,
    SELECCIONES,
  );

  // ── USUARIO: helper para insertar usuarios en lote ─────────────────────────
  // Genera filas USUARIO con mail bulk_<tag><i>@test.com y doc único.
  async function insertUsuarios(tag, n, startDoc) {
    const cols = ["doc_pais", "doc_tipo", "doc_numero", "mail", "contrasena", "dir_pais", "dir_localidad", "dir_calle", "dir_numero", "dir_codigo_postal"];
    const rows = [];
    for (let i = 0; i < n; i++) {
      const doc = `${tag.toUpperCase()}${pad(startDoc + i)}`;
      rows.push([pick(SELECCIONES), "CI", doc, `bulk_${tag}${i}@test.com`, hash, pick(SELECCIONES), "Ciudad", "Calle", rnd(1, 9999), String(rnd(10000, 99999))]);
    }
    await batch("USUARIO", cols, rows);
    // Recuperar los ids recién creados de este tag
    const ids = await q(
      `SELECT id_usuario FROM USUARIO WHERE mail LIKE 'bulk_${tag}%' ORDER BY id_usuario`,
    );
    return ids.map((r) => r.id_usuario);
  }

  // ── ADMINS: uno por país anfitrión (jurisdicción USA / Canadá / México) ────
  const adminIds = await insertUsuarios("admin", HOSTS.length, 1);
  await batch(
    "ADMIN_POR_SEDE",
    ["id_usuario", "pais_jurisdiccion", "fecha_asignacion"],
    adminIds.map((id, i) => [id, HOSTS[i], fechaSlot(-200)]),
  );
  const adminPorHost = Object.fromEntries(HOSTS.map((h, i) => [h, adminIds[i]]));

  // ── FUNCIONARIOS + DISPOSITIVOS ────────────────────────────────────────────
  const funIds = await insertUsuarios("fun", N_FUNCIONARIOS, 1);
  await batch(
    "FUNCIONARIO_VALIDACION",
    ["id_usuario", "numero_legajo"],
    funIds.map((id, i) => [id, 700000 + i]),
  );
  await batch("DISPOSITIVO", ["fun_id_usuario"], funIds.map((id) => [id]));

  // ── CLIENTES ───────────────────────────────────────────────────────────────
  const cliIds = await insertUsuarios("cli", N_CLIENTES, 1);
  await batch("USUARIO_GENERAL", ["id_usuario", "estado_verificacion"],
    cliIds.map((id) => [id, pick(["verificado", "pendiente", "rechazado"])]));

  // ── ESTADIOS reales del Mundial 2026 + SECTORES ────────────────────────────
  const estadios = []; // {id, pais}
  for (let i = 0; i < N_ESTADIOS; i++) {
    const sede = SEDES[i];
    const r = await q(
      "INSERT INTO ESTADIO (nombre, pais, ciudad) VALUES (?, ?, ?)",
      [sede.nombre, sede.pais, sede.ciudad],
    );
    estadios.push({ id: r.insertId, pais: sede.pais });
  }
  const sectorRows = [];
  for (const e of estadios) for (const s of SECTORES) sectorRows.push([s.n, e.id, s.cap]);
  await batch("SECTOR", ["nombre_sector", "id_estadio", "capacidad_max"], sectorRows);

  // ── PARTIDOS (1 por estadio por slot → sin solapamiento, mezcla pasado/futuro) ─
  // admin_id_usuario = admin del país anfitrión del estadio (marca para cleanup).
  const partidos = []; // {id, id_estadio, fecha, pasado}
  let creados = 0;
  const porEstadio = Math.ceil(N_PARTIDOS / estadios.length);
  outer: for (let m = 0; m < porEstadio; m++) {
    for (const e of estadios) {
      if (creados >= N_PARTIDOS) break outer;
      const dayOffset = -12 + m * 7; // -12, -5, +2, +9, … (primeros pasados, resto futuros)
      const fecha = fechaSlot(dayOffset);
      let local = pick(SELECCIONES), visit = pick(SELECCIONES);
      while (visit === local) visit = pick(SELECCIONES);
      const r = await q(
        "INSERT INTO PARTIDO (fecha_hora, id_estadio, equipo_pais_local, equipo_pais_visitante, admin_id_usuario) VALUES (?, ?, ?, ?, ?)",
        [fecha, e.id, local, visit, adminPorHost[e.pais]],
      );
      partidos.push({ id: r.insertId, id_estadio: e.id, fecha, pasado: dayOffset < 0 });
      creados++;
    }
  }

  // ── SECTOR_PARTIDO (habilitar todos los sectores de cada partido con costo) ──
  const spRows = [];
  for (const p of partidos)
    for (const s of SECTORES)
      spRows.push([s.n, p.id_estadio, p.id, rnd(300, 2500)]);
  await batch("SECTOR_PARTIDO", ["sector_nombre_sector", "sector_id_estadio", "partido_id_evento", "costo_entrada"], spRows);

  // ── VENTAS + ENTRADAS ──────────────────────────────────────────────────────
  // Para cada sector-partido se venden hasta MAX_VENDIDAS_SECTOR (o capacidad) entradas,
  // en ventas de 1..5 entradas, respetando ambas reglas.
  const capDe = (n) => SECTORES.find((s) => s.n === n).cap;
  const entradaRows = []; // [venta_id, nombre, id_estadio, id_evento, propietario]
  const entradasInfo = []; // {sector,id_estadio,id_evento,owner,pasado} para transfer/validación
  let ventaCount = 0;
  const TASA = 0.05;

  for (const p of partidos) {
    for (const s of SECTORES) {
      const objetivo = Math.min(capDe(s.n), rnd(10, MAX_VENDIDAS_SECTOR));
      const costo = rnd(300, 2500);
      let vendidas = 0;
      while (vendidas < objetivo) {
        const cant = Math.min(rnd(1, 5), objetivo - vendidas);
        const owner = pick(cliIds);
        const subtotal = costo * cant;
        const monto = Math.round(subtotal * (1 + TASA) * 100) / 100;
        const v = await q(
          "INSERT INTO VENTA (estado, monto_total, tasa_comision, id_usuario) VALUES ('realizada', ?, ?, ?)",
          [monto, TASA, owner],
        );
        ventaCount++;
        for (let k = 0; k < cant; k++) {
          entradaRows.push([v.insertId, s.n, p.id_estadio, p.id, owner]);
          entradasInfo.push({ sector: s.n, id_estadio: p.id_estadio, id_evento: p.id, owner, pasado: p.pasado });
        }
        vendidas += cant;
      }
    }
  }
  const nEntradas = await batch(
    "ENTRADA",
    ["venta_id_venta", "sectorpartido_nombre_sector", "sectorpartido_id_estadio", "sectorpartido_id_evento", "propietario_id_usuario"],
    entradaRows,
  );

  // ── ASIGNACIONES funcionario → sector-partido (partidos pasados) ────────────
  const fsp = [];
  for (const p of partidos.filter((x) => x.pasado)) {
    for (const s of SECTORES) {
      fsp.push([pick(funIds), s.n, p.id_estadio, p.id]);
    }
  }
  // dedup (PK compuesta): por sector-partido un solo funcionario
  const fspUniq = Array.from(new Map(fsp.map((r) => [`${r[1]}-${r[2]}-${r[3]}`, r])).values());
  if (fspUniq.length)
    await batch("FUNCIONARIO_SECTOR_PARTIDO", ["funcionario_id_usuario", "sectorpartido_nombre_sector", "sectorpartido_id_estadio", "sectorpartido_id_evento"], fspUniq);

  // Ids de los estadios bulk recién creados (para acotar transfer/validación).
  const estIn = `(${estadios.map((e) => e.id).join(",")})`;

  // ── TRANSFERENCIAS (sobre entradas de partidos futuros) ────────────────────
  // Tomamos una muestra de entradas futuras y creamos transferencias con estados variados.
  const futurasIds = await q(
    `SELECT e.id_boleto, e.propietario_id_usuario AS owner
     FROM ENTRADA e JOIN PARTIDO p ON p.id_evento = e.sectorpartido_id_evento
     WHERE p.fecha_hora > NOW() AND e.sectorpartido_id_estadio IN ${estIn}
     ORDER BY RAND() LIMIT 200`,
  );
  let transfCount = 0;
  for (const e of futurasIds) {
    let dest = pick(cliIds);
    if (dest === e.owner) continue;
    const estado = pick(["pendiente", "pendiente", "aceptada", "rechazada"]);
    await q(
      "INSERT INTO TRANSFERENCIA (estado, entrada_id_boleto, origen_id_usuario, destino_id_usuario) VALUES (?, ?, ?, ?)",
      [estado, e.id_boleto, e.owner, dest],
    );
    if (estado === "aceptada")
      await q("UPDATE ENTRADA SET propietario_id_usuario = ? WHERE id_boleto = ?", [dest, e.id_boleto]);
    transfCount++;
  }

  // ── VALIDACIONES (entradas de partidos pasados, sector con funcionario asignado) ─
  const validables = await q(
    `SELECT e.id_boleto, fsp.funcionario_id_usuario AS fun, d.id_dispositivo AS disp
     FROM ENTRADA e
     JOIN PARTIDO p ON p.id_evento = e.sectorpartido_id_evento
     JOIN FUNCIONARIO_SECTOR_PARTIDO fsp
       ON fsp.sectorpartido_nombre_sector = e.sectorpartido_nombre_sector
      AND fsp.sectorpartido_id_estadio = e.sectorpartido_id_estadio
      AND fsp.sectorpartido_id_evento = e.sectorpartido_id_evento
     JOIN DISPOSITIVO d ON d.fun_id_usuario = fsp.funcionario_id_usuario AND d.activo = TRUE
     WHERE p.fecha_hora < NOW()
       AND e.sectorpartido_id_estadio IN ${estIn}
     ORDER BY RAND() LIMIT 1000`,
  );
  let valCount = 0;
  const valRows = [];
  for (const e of validables) {
    if (Math.random() > 0.5) continue; // validar ~50%
    const token = `bulkval_${e.id_boleto}_${rnd(100000, 999999)}`;
    valRows.push([token, e.disp, e.fun, e.id_boleto]);
  }
  if (valRows.length) {
    await batch("VALIDACION", ["qr_usado", "id_dispositivo", "funcionario_id_usuario", "id_boleto"], valRows);
    await q(
      `UPDATE ENTRADA SET estado='utilizada' WHERE id_boleto IN (${valRows.map(() => "?").join(",")})`,
      valRows.map((r) => r[3]),
    );
    valCount = valRows.length;
  }

  // ── Resumen ────────────────────────────────────────────────────────────────
  const seg = ((Date.now() - t0) / 1000).toFixed(1);
  console.log("\n──────────── RESUMEN ────────────");
  console.log(`Selecciones:       ${SELECCIONES.length} (compartidas)`);
  console.log(`Admins por sede:   ${adminIds.length} (${HOSTS.join(", ")})`);
  console.log(`Funcionarios:      ${funIds.length} (con dispositivo)`);
  console.log(`Clientes:          ${cliIds.length}`);
  console.log(`Estadios:          ${estadios.length}  ·  Sectores: ${sectorRows.length}`);
  console.log(`Partidos:          ${partidos.length}  (${partidos.filter(p=>p.pasado).length} pasados, ${partidos.filter(p=>!p.pasado).length} futuros)`);
  console.log(`Sector-partido:    ${spRows.length}`);
  console.log(`Ventas:            ${ventaCount}`);
  console.log(`Entradas:          ${nEntradas}`);
  console.log(`Transferencias:    ${transfCount}`);
  console.log(`Validaciones:      ${valCount}`);
  console.log(`\nContraseña de todos los usuarios generados: ${PASSWORD}`);
  console.log(`Mails: bulk_admin*@test.com · bulk_fun*@test.com · bulk_cli*@test.com`);
  console.log(`Hecho en ${seg}s. (Volvé a correrlo para regenerar; borra lo anterior automáticamente.)`);
} catch (err) {
  console.error("\nError en el seed:", err.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
