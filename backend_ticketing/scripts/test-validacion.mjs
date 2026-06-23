/**
 * Test de validación de entrada en puerta (caso feliz + casos de error).
 *
 * Qué hace:
 *   1. Seedea un escenario aislado (estadio/sectores/partidos/entradas/funcionario asignado).
 *   2. Caso feliz: genera el QR real vía el endpoint, lo escanea, y verifica en la DB
 *      que la entrada pasó de 'activo' a 'utilizada' y que se registró la VALIDACION.
 *   3. Casos de error: re-validación, QR vencido, QR inexistente, funcionario no asignado,
 *      fuera de la ventana de ±3h.
 *   4. Limpia todos los datos de prueba al terminar.
 *
 * Requisitos: backend levantado y la DB accesible desde el host.
 *
 * Config por variables de entorno (con defaults). Si tu puerto/credenciales
 * difieren, sobreescribilas al correr. Por ejemplo (DB en 3306):
 *
 *   DB_PORT=3306 node scripts/test-validacion.mjs
 *
 * Variables disponibles (default entre paréntesis):
 *   API_URL      (http://localhost:3000)
 *   DB_HOST      (127.0.0.1)
 *   DB_PORT      (3307)            ← en Windows 3306
 *   DB_USER      (root)
 *   DB_PASSWORD  (root_pass)
 *   DB_NAME      (ticketing_db)
 *   JWT_SECRET   (jwt_secret_dev)  ← debe coincidir con el secret del backend
 */

import mysql from "mysql2/promise";
import crypto from "node:crypto";

// ── Config (override por env) ────────────────────────────────────────────────
const API = process.env.API_URL ?? "http://localhost:3000";
// El backend usa process.env.JWT_SECRET ?? 'jwt_secret_dev'. El token minteado
// acá debe firmarse con EXACTAMENTE el mismo secret que usa el backend.
const JWT_SECRET = process.env.JWT_SECRET ?? "jwt_secret_dev";
const DB = {
  host: process.env.DB_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 3307),
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "root_pass",
  database: process.env.DB_NAME ?? "ticketing_db",
  multipleStatements: true,
};

// Marcadores para identificar/limpiar datos de prueba (el script inserta TODO esto)
const ESTADIO_TEST = "TEST_ESTADIO_VAL";
const CLIENTE_MAIL = "testval_cliente@test.com";
const FUN_MAIL = "testval_funcionario@test.com";
const FUN_LEGAJO = 999001;
const EQUIPO_LOCAL = "TESTPAIS_LOCAL";
const EQUIPO_VISIT = "TESTPAIS_VISITANTE";

// ── Helpers de salida ────────────────────────────────────────────────────────
const c = {
  g: (s) => `\x1b[32m${s}\x1b[0m`,
  r: (s) => `\x1b[31m${s}\x1b[0m`,
  y: (s) => `\x1b[33m${s}\x1b[0m`,
  b: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};
let pass = 0;
let fail = 0;
function section(t) {
  console.log("\n" + c.b("━".repeat(70)));
  console.log(c.b(t));
  console.log(c.b("━".repeat(70)));
}
function ok(label, detail = "") {
  pass++;
  console.log(`${c.g("✓ PASS")}  ${label}${detail ? "  " + c.dim(detail) : ""}`);
}
function bad(label, detail = "") {
  fail++;
  console.log(`${c.r("✗ FAIL")}  ${label}${detail ? "  " + c.dim(detail) : ""}`);
}

// ── JWT (HS256) ──────────────────────────────────────────────────────────────
function mintJWT(sub, role) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({ sub, role, iat: now, exp: now + 3600 });
  const sig = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${head}.${body}`)
    .digest("base64url");
  return `${head}.${body}.${sig}`;
}

// ── HTTP ─────────────────────────────────────────────────────────────────────
async function api(method, path, token, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}
function msgOf(data) {
  const m = data?.message;
  return Array.isArray(m) ? m[0] : (m ?? JSON.stringify(data));
}

// ── Main ─────────────────────────────────────────────────────────────────────
const db = await mysql.createConnection(DB);
const q = async (sql, params = []) => (await db.query(sql, params))[0];

async function cleanup() {
  const [est] = await q("SELECT id_estadio FROM ESTADIO WHERE nombre = ?", [ESTADIO_TEST]);
  const [cli] = await q("SELECT id_usuario FROM USUARIO WHERE mail = ?", [CLIENTE_MAIL]);
  const [fun] = await q("SELECT id_usuario FROM USUARIO WHERE mail = ?", [FUN_MAIL]);
  const E = est?.id_estadio;
  const C = cli?.id_usuario;
  const F = fun?.id_usuario;

  // Orden inverso a las FK (RESTRICT).
  if (F) await q("DELETE FROM VALIDACION WHERE funcionario_id_usuario = ?", [F]);
  if (E) {
    await q("DELETE FROM VALIDACION WHERE id_boleto IN (SELECT id_boleto FROM ENTRADA WHERE sectorpartido_id_estadio = ?)", [E]);
    await q("DELETE FROM ENTRADA WHERE sectorpartido_id_estadio = ?", [E]);
    await q("DELETE FROM FUNCIONARIO_SECTOR_PARTIDO WHERE sectorpartido_id_estadio = ?", [E]);
    await q("DELETE FROM SECTOR_PARTIDO WHERE sector_id_estadio = ?", [E]);
  }
  if (C) await q("DELETE FROM VENTA WHERE id_usuario = ?", [C]);
  if (F) await q("DELETE FROM DISPOSITIVO WHERE fun_id_usuario = ?", [F]);
  if (E) {
    await q("DELETE FROM PARTIDO WHERE id_estadio = ?", [E]);
    await q("DELETE FROM SECTOR WHERE id_estadio = ?", [E]);
    await q("DELETE FROM ESTADIO WHERE id_estadio = ?", [E]);
  }
  if (F) await q("DELETE FROM FUNCIONARIO_VALIDACION WHERE id_usuario = ?", [F]);
  if (C) await q("DELETE FROM USUARIO_GENERAL WHERE id_usuario = ?", [C]);
  await q("DELETE FROM USUARIO WHERE mail IN (?, ?)", [CLIENTE_MAIL, FUN_MAIL]);
  // Equipos de prueba (ya sin referencias de estadio/partido)
  await q("DELETE FROM EQUIPO WHERE pais IN (?, ?)", [EQUIPO_LOCAL, EQUIPO_VISIT]);
}

let scenario;
async function seed() {
  // Equipos de prueba (local ≠ visitante) — los inserta el propio script
  const local = EQUIPO_LOCAL;
  const visitante = EQUIPO_VISIT;
  await q("INSERT INTO EQUIPO (pais) VALUES (?), (?)", [local, visitante]);

  // Estadio de prueba (país = equipo local)
  const est = await q(
    "INSERT INTO ESTADIO (nombre, pais, ciudad) VALUES (?, ?, 'TestCity')",
    [ESTADIO_TEST, local],
  );
  const E = est.insertId;

  // Sectores A (asignado al funcionario) y B (NO asignado)
  await q("INSERT INTO SECTOR (nombre_sector, id_estadio, capacidad_max) VALUES ('TEST_A', ?, 100), ('TEST_B', ?, 100)", [E, E]);

  // Partido P1 dentro de la ventana (+30 min) y P2 fuera de la ventana (+10 h)
  const p1 = await q(
    "INSERT INTO PARTIDO (fecha_hora, id_estadio, equipo_pais_local, equipo_pais_visitante) VALUES (DATE_ADD(NOW(), INTERVAL 30 MINUTE), ?, ?, ?)",
    [E, local, visitante],
  );
  const P1 = p1.insertId;
  const p2 = await q(
    "INSERT INTO PARTIDO (fecha_hora, id_estadio, equipo_pais_local, equipo_pais_visitante) VALUES (DATE_ADD(NOW(), INTERVAL 10 HOUR), ?, ?, ?)",
    [E, local, visitante],
  );
  const P2 = p2.insertId;

  // Habilitar sectores en los partidos
  await q(
    `INSERT INTO SECTOR_PARTIDO (sector_nombre_sector, sector_id_estadio, partido_id_evento, costo_entrada) VALUES
       ('TEST_A', ?, ?, 500.00), ('TEST_B', ?, ?, 500.00), ('TEST_A', ?, ?, 500.00)`,
    [E, P1, E, P1, E, P2],
  );

  // Funcionario de validación de prueba (USUARIO + FUNCIONARIO_VALIDACION) + su dispositivo
  const funU = await q(
    `INSERT INTO USUARIO (doc_pais, doc_tipo, doc_numero, mail, contrasena, dir_pais, dir_localidad, dir_calle, dir_numero, dir_codigo_postal)
     VALUES ('TestDoc', 'CI', 'TESTVALFUN', ?, 'x', 'TestDir', 'Mvd', 'Calle', 1, '11000')`,
    [FUN_MAIL],
  );
  const F = funU.insertId;
  await q("INSERT INTO FUNCIONARIO_VALIDACION (id_usuario, numero_legajo) VALUES (?, ?)", [F, FUN_LEGAJO]);
  await q("INSERT INTO DISPOSITIVO (fun_id_usuario) VALUES (?)", [F]);

  // Asignar el funcionario a TEST_A de P1 y P2 (NO a TEST_B)
  await q(
    `INSERT INTO FUNCIONARIO_SECTOR_PARTIDO (funcionario_id_usuario, sectorpartido_nombre_sector, sectorpartido_id_estadio, sectorpartido_id_evento) VALUES
       (?, 'TEST_A', ?, ?), (?, 'TEST_A', ?, ?)`,
    [F, E, P1, F, E, P2],
  );

  // Cliente dueño de las entradas
  const cli = await q(
    `INSERT INTO USUARIO (doc_pais, doc_tipo, doc_numero, mail, contrasena, dir_pais, dir_localidad, dir_calle, dir_numero, dir_codigo_postal)
     VALUES (?, 'CI', 'TESTVAL1', ?, 'x', ?, 'Mvd', 'Calle', 1, '11000')`,
    [local, CLIENTE_MAIL, local],
  );
  const C = cli.insertId;
  await q("INSERT INTO USUARIO_GENERAL (id_usuario) VALUES (?)", [C]);

  // Venta + entradas
  const venta = await q(
    "INSERT INTO VENTA (estado, monto_total, tasa_comision, id_usuario) VALUES ('realizada', 2100.00, 0.05, ?)",
    [C],
  );
  const V = venta.insertId;
  const mkEntrada = async (sector, evento) => {
    const r = await q(
      `INSERT INTO ENTRADA (venta_id_venta, sectorpartido_nombre_sector, sectorpartido_id_estadio, sectorpartido_id_evento, propietario_id_usuario)
       VALUES (?, ?, ?, ?, ?)`,
      [V, sector, E, evento, C],
    );
    return r.insertId;
  };
  const eA1 = await mkEntrada("TEST_A", P1); // caso feliz
  const eA2 = await mkEntrada("TEST_A", P1); // QR vencido
  const eB1 = await mkEntrada("TEST_B", P1); // funcionario no asignado
  const eC1 = await mkEntrada("TEST_A", P2); // fuera de ventana

  scenario = { E, P1, P2, C, F, eA1, eA2, eB1, eC1, local, visitante };
}

try {
  section("SETUP — limpiando datos previos y seedeando escenario");
  console.log(c.dim(`API: ${API}  ·  DB: ${DB.user}@${DB.host}:${DB.port}/${DB.database}`));
  await cleanup();
  await seed();
  const { eA1, eA2, eB1, eC1 } = scenario;
  const clienteTok = mintJWT(scenario.C, "CLIENTE");
  const funTok = mintJWT(scenario.F, "FUNCIONARIO");
  console.log(
    c.dim(
      `Estadio #${scenario.E} · Partido en ventana #${scenario.P1} · Partido fuera de ventana #${scenario.P2}\n` +
        `Cliente #${scenario.C} · Funcionario #${scenario.F} legajo ${FUN_LEGAJO} (asignado a TEST_A, con dispositivo)\n` +
        `Entradas: eA1=${eA1} (feliz), eA2=${eA2} (vencido), eB1=${eB1} (no asignado), eC1=${eC1} (fuera ventana)`,
    ),
  );

  // ── CASO FELIZ ─────────────────────────────────────────────────────────────
  section("CASO FELIZ — generar QR → validar → verificar cambio en la DB");

  const gen = await api("GET", `/validacion/qr/${eA1}`, clienteTok);
  console.log(`1) El cliente genera el QR de la entrada #${eA1}:`);
  console.log(`   token   = ${c.y(gen.data?.qr_token ?? msgOf(gen.data))}`);
  console.log(`   vigencia= ${gen.data?.vigencia_segundos}s`);
  gen.data?.qr_token && gen.data?.vigencia_segundos === 30
    ? ok("Se generó el string del QR con vigencia de 30s")
    : bad("No se generó el QR", `HTTP ${gen.status} ${msgOf(gen.data)}`);

  const [antes] = await q("SELECT estado FROM ENTRADA WHERE id_boleto = ?", [eA1]);
  console.log(`2) Estado en la DB antes de validar: ${c.b(antes.estado)}`);
  antes.estado === "activo" ? ok("La entrada está 'activo' antes de validar") : bad("Estado inesperado", antes.estado);

  const scan = await api("POST", "/validacion/escanear", funTok, { qr_token: gen.data.qr_token });
  console.log(`3) El funcionario escanea el QR → HTTP ${scan.status}`);
  console.log(`   respuesta = ${c.dim(JSON.stringify(scan.data))}`);
  scan.status < 300 && scan.data?.validado === true
    ? ok("El endpoint validó la entrada")
    : bad("La validación falló", `HTTP ${scan.status} ${msgOf(scan.data)}`);

  const [despues] = await q("SELECT estado, qr_token_actual FROM ENTRADA WHERE id_boleto = ?", [eA1]);
  const [val] = await q("SELECT qr_usado, funcionario_id_usuario, id_dispositivo FROM VALIDACION WHERE id_boleto = ?", [eA1]);
  console.log(`4) Estado en la DB después de validar: ${c.b(despues.estado)}`);
  despues.estado === "utilizada"
    ? ok("La entrada cambió 'activo' → 'utilizada'")
    : bad("La entrada NO cambió de estado", despues.estado);
  despues.qr_token_actual === null ? ok("El QR quedó invalidado (token NULL)") : bad("El QR no se invalidó");
  val ? ok("Se registró la VALIDACION", `qr_usado + funcionario #${val.funcionario_id_usuario} + dispositivo #${val.id_dispositivo}`) : bad("No se registró la VALIDACION");

  // ── CASOS DE ERROR ─────────────────────────────────────────────────────────
  section("CASOS DE ERROR — cada uno debe ser rechazado con su motivo");

  // E1: re-validar la misma entrada (token ya consumido / invalidado)
  const e1 = await api("POST", "/validacion/escanear", funTok, { qr_token: gen.data.qr_token });
  e1.status >= 400 ? ok("E1 · Re-escanear el mismo QR es rechazado", `HTTP ${e1.status}: "${msgOf(e1.data)}"`) : bad("E1 · Se aceptó un QR ya usado");

  // E2: intentar generar QR de una entrada ya utilizada
  const e2 = await api("GET", `/validacion/qr/${eA1}`, clienteTok);
  e2.status >= 400 ? ok("E2 · No se puede generar QR de una entrada utilizada", `HTTP ${e2.status}: "${msgOf(e2.data)}"`) : bad("E2 · Generó QR de entrada utilizada");

  // E3: QR vencido (se genera y se fuerza la expiración en la DB)
  const g3 = await api("GET", `/validacion/qr/${eA2}`, clienteTok);
  await q("UPDATE ENTRADA SET qr_token_expira_en = DATE_SUB(NOW(), INTERVAL 1 SECOND) WHERE id_boleto = ?", [eA2]);
  const e3 = await api("POST", "/validacion/escanear", funTok, { qr_token: g3.data.qr_token });
  e3.status >= 400 ? ok("E3 · QR vencido es rechazado", `HTTP ${e3.status}: "${msgOf(e3.data)}"`) : bad("E3 · Se aceptó un QR vencido");

  // E4: QR inexistente / inválido
  const e4 = await api("POST", "/validacion/escanear", funTok, { qr_token: "token-que-no-existe-123" });
  e4.status >= 400 ? ok("E4 · QR inexistente es rechazado", `HTTP ${e4.status}: "${msgOf(e4.data)}"`) : bad("E4 · Se aceptó un QR inexistente");

  // E5: funcionario no asignado a ese sector (entrada de TEST_B)
  const g5 = await api("GET", `/validacion/qr/${eB1}`, clienteTok);
  const e5 = await api("POST", "/validacion/escanear", funTok, { qr_token: g5.data.qr_token });
  e5.status >= 400 ? ok("E5 · Funcionario no asignado al sector es rechazado", `HTTP ${e5.status}: "${msgOf(e5.data)}"`) : bad("E5 · Validó en un sector no asignado");

  // E6: fuera de la ventana de ±3h (partido en +10h)
  const g6 = await api("GET", `/validacion/qr/${eC1}`, clienteTok);
  const e6 = await api("POST", "/validacion/escanear", funTok, { qr_token: g6.data.qr_token });
  e6.status >= 400 ? ok("E6 · Fuera de la ventana de validación es rechazado", `HTTP ${e6.status}: "${msgOf(e6.data)}"`) : bad("E6 · Validó fuera de la ventana de ±3h");

  // ── Resumen ────────────────────────────────────────────────────────────────
  section("RESUMEN");
  console.log(`${c.g(`${pass} PASS`)}   ${fail ? c.r(`${fail} FAIL`) : c.dim("0 FAIL")}`);
} catch (err) {
  console.error(c.r("\nError ejecutando el test:"), err.message);
  fail++;
} finally {
  section("CLEANUP — eliminando datos de prueba");
  await cleanup();
  console.log(c.dim("Datos de prueba eliminados."));
  await db.end();
  process.exit(fail ? 1 : 0);
}
