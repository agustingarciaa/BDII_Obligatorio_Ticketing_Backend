CREATE DATABASE IF NOT EXISTS ticketing_db;
USE ticketing_db;

CREATE TABLE ESTADIO (
  id_estadio  INT          PRIMARY KEY AUTO_INCREMENT,
  nombre      VARCHAR(100) NOT NULL,
  pais        VARCHAR(50)  NOT NULL,
  ciudad      VARCHAR(100) NOT NULL,
  activo      BOOLEAN      NOT NULL DEFAULT TRUE
  FOREIGN KEY (pais) REFERENCES EQUIPO(pais) ON DELETE RESTRICT
);

CREATE TABLE SECTOR (
  nombre_sector  VARCHAR(50) NOT NULL,
  id_estadio INT         NOT NULL,
  capacidad_max  INT         NOT NULL,
  activo         BOOLEAN     NOT NULL DEFAULT TRUE,
  PRIMARY KEY (nombre_sector, id_estadio),
  FOREIGN KEY (id_estadio) REFERENCES ESTADIO(id_estadio) ON DELETE RESTRICT
);

CREATE TABLE EQUIPO (
  pais   VARCHAR(50) PRIMARY KEY,
  activo BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE TABLE USUARIO (
  id_usuario          INT          PRIMARY KEY AUTO_INCREMENT,
  doc_pais            VARCHAR(50)  NOT NULL,
  doc_tipo            VARCHAR(50)  NOT NULL,
  doc_numero          VARCHAR(50)  NOT NULL,
  mail                VARCHAR(100) NOT NULL UNIQUE,
  contrasena VARCHAR(255) NOT NULL,
  dir_pais            VARCHAR(50)  NOT NULL,
  dir_localidad       VARCHAR(100) NOT NULL,
  dir_calle           VARCHAR(100) NOT NULL,
  dir_numero          INT          NOT NULL,
  dir_codigo_postal   VARCHAR(20)  NOT NULL,
  activo              BOOLEAN      NOT NULL DEFAULT TRUE,
  UNIQUE (doc_pais, doc_tipo, doc_numero)
);

CREATE TABLE TELEFONO_USUARIO (
  id_usuario INT         NOT NULL,
  telefono       VARCHAR(20) NOT NULL,
  activo         BOOLEAN     NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id_usuario, telefono),
  FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario) ON DELETE RESTRICT
);

CREATE TABLE ADMIN_POR_SEDE (
  id_usuario    INT         NOT NULL,
  pais_jurisdiccion VARCHAR(50) NOT NULL,
  fecha_asignacion  DATETIME    NOT NULL,
  activo            BOOLEAN     NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id_usuario),
  FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario) ON DELETE RESTRICT
);

CREATE TABLE FUNCIONARIO_VALIDACION (
  id_usuario INT NOT NULL,
  numero_legajo  INT NOT NULL UNIQUE,
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id_usuario),
  FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario) ON DELETE RESTRICT
);

CREATE TABLE DISPOSITIVO (
  id_dispositivo INT     PRIMARY KEY AUTO_INCREMENT,
  fun_id_usuario INT     NOT NULL,
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (fun_id_usuario),
  FOREIGN KEY (fun_id_usuario) REFERENCES FUNCIONARIO_VALIDACION(id_usuario) ON DELETE RESTRICT
);

CREATE TABLE USUARIO_GENERAL (
  id_usuario      INT         NOT NULL,
  fecha_registro      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado_verificacion VARCHAR(50) NOT NULL DEFAULT 'pendiente',
  activo              BOOLEAN     NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id_usuario),
  FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario) ON DELETE RESTRICT
);

CREATE TABLE PARTIDO (
  id_evento         INT         PRIMARY KEY AUTO_INCREMENT,
  fecha_hora        DATETIME    NOT NULL,
  id_estadio    INT         NOT NULL,
  equipo_pais_local     VARCHAR(50) NOT NULL,
  equipo_pais_visitante VARCHAR(50) NOT NULL,
  admin_id_usuario    INT         NULL,
  activo            BOOLEAN     NOT NULL DEFAULT TRUE,
  UNIQUE (id_estadio, fecha_hora),
  FOREIGN KEY (id_estadio)    REFERENCES ESTADIO(id_estadio)             ON DELETE RESTRICT,
  FOREIGN KEY (equipo_pais_local)     REFERENCES EQUIPO(pais)                    ON DELETE RESTRICT,
  FOREIGN KEY (equipo_pais_visitante) REFERENCES EQUIPO(pais)                    ON DELETE RESTRICT,
  FOREIGN KEY (admin_id_usuario)    REFERENCES ADMIN_POR_SEDE(id_usuario)  ON DELETE SET NULL
);

CREATE TABLE SECTOR_PARTIDO (
  sector_nombre_sector VARCHAR(50)    NOT NULL,
  sector_id_estadio    INT            NOT NULL,
  partido_id_evento     INT            NOT NULL,
  costo_entrada     DECIMAL(10, 2) NOT NULL,
  activo            BOOLEAN        NOT NULL DEFAULT TRUE,
  PRIMARY KEY (sector_nombre_sector, sector_id_estadio, partido_id_evento),
  FOREIGN KEY (sector_nombre_sector, sector_id_estadio)
    REFERENCES SECTOR(nombre_sector, id_estadio) ON DELETE RESTRICT,
  FOREIGN KEY (partido_id_evento) REFERENCES PARTIDO(id_evento) ON DELETE RESTRICT
);

CREATE TABLE FUNCIONARIO_SECTOR_PARTIDO (
  funcionario_id_usuario   INT         NOT NULL,
  sectorpartido_nombre_sector VARCHAR(50) NOT NULL,
  sectorpartido_id_estadio    INT         NOT NULL,
  sectorpartido_id_evento     INT         NOT NULL,
  activo           BOOLEAN     NOT NULL DEFAULT TRUE,
  PRIMARY KEY (funcionario_id_usuario, sectorpartido_nombre_sector, sectorpartido_id_estadio, sectorpartido_id_evento),
  FOREIGN KEY (funcionario_id_usuario)
    REFERENCES FUNCIONARIO_VALIDACION(id_usuario) ON DELETE RESTRICT,
  FOREIGN KEY (sectorpartido_nombre_sector, sectorpartido_id_estadio, sectorpartido_id_evento)
    REFERENCES SECTOR_PARTIDO(sector_nombre_sector, sector_id_estadio, partido_id_evento) ON DELETE RESTRICT
);

CREATE TABLE VENTA (
  id_venta       INT            PRIMARY KEY AUTO_INCREMENT,
  fecha          DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado         VARCHAR(50)    NOT NULL DEFAULT 'pendiente',
  monto_total    DECIMAL(10, 2) NOT NULL,
  tasa_comision  DECIMAL(5, 4)  NOT NULL DEFAULT 0.0500,
  id_usuario INT            NOT NULL,
  activo         BOOLEAN        NOT NULL DEFAULT TRUE,
  FOREIGN KEY (id_usuario) REFERENCES USUARIO_GENERAL(id_usuario) ON DELETE RESTRICT
);

CREATE TABLE ENTRADA (
  id_boleto          INT          PRIMARY KEY AUTO_INCREMENT,
  estado             VARCHAR(50)  NOT NULL DEFAULT 'activo',
  qr_token_actual    VARCHAR(255) NULL,
  qr_token_expira_en DATETIME     NULL,
  venta_id_venta       INT          NOT NULL,
  sectorpartido_nombre_sector   VARCHAR(50)  NOT NULL,
  sectorpartido_id_estadio      INT          NOT NULL,
  sectorpartido_id_evento       INT          NOT NULL,
  propietario_id_usuario    INT          NOT NULL,
  activo             BOOLEAN      NOT NULL DEFAULT TRUE,
  FOREIGN KEY (venta_id_venta) REFERENCES VENTA(id_venta) ON DELETE RESTRICT,
  FOREIGN KEY (sectorpartido_nombre_sector, sectorpartido_id_estadio, sectorpartido_id_evento)
    REFERENCES SECTOR_PARTIDO(sector_nombre_sector, sector_id_estadio, partido_id_evento) ON DELETE RESTRICT,
  FOREIGN KEY (propietario_id_usuario) REFERENCES USUARIO_GENERAL(id_usuario) ON DELETE RESTRICT
);

CREATE TABLE TRANSFERENCIA (
  id_transferencia   INT         PRIMARY KEY AUTO_INCREMENT,
  fecha              DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado             VARCHAR(50) NOT NULL DEFAULT 'pendiente',
  entrada_id_boleto      INT         NOT NULL,
  origen_id_usuario  INT         NOT NULL,
  destino_id_usuario INT         NOT NULL,
  activo             BOOLEAN     NOT NULL DEFAULT TRUE,
  FOREIGN KEY (entrada_id_boleto) REFERENCES ENTRADA(id_boleto) ON DELETE RESTRICT,
  FOREIGN KEY (origen_id_usuario)  REFERENCES USUARIO_GENERAL(id_usuario) ON DELETE RESTRICT,
  FOREIGN KEY (destino_id_usuario) REFERENCES USUARIO_GENERAL(id_usuario) ON DELETE RESTRICT
);

CREATE TABLE VALIDACION (
  qr_usado           VARCHAR(255) PRIMARY KEY,
  fecha              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  id_dispositivo INT          NOT NULL,
  funcionario_id_usuario     INT          NOT NULL,
  id_boleto      INT          NOT NULL UNIQUE,
  activo             BOOLEAN      NOT NULL DEFAULT TRUE,
  FOREIGN KEY (id_dispositivo) REFERENCES DISPOSITIVO(id_dispositivo)            ON DELETE RESTRICT,
  FOREIGN KEY (funcionario_id_usuario)     REFERENCES FUNCIONARIO_VALIDACION(id_usuario) ON DELETE RESTRICT,
  FOREIGN KEY (id_boleto)      REFERENCES ENTRADA(id_boleto)                     ON DELETE RESTRICT
);

-- =============================================================
-- USUARIOS Y PERMISOS
-- =============================================================

-- 1. ticketing_sistema: acceso total, para migraciones y administración del sistema
CREATE USER IF NOT EXISTS 'ticketing_sistema'@'%' IDENTIFIED BY 'sistema_pass';
GRANT ALL PRIVILEGES ON ticketing_db.* TO 'ticketing_sistema'@'%';

-- 2. ticketing_admin: gestiona infraestructura, eventos y funcionarios; ve estadísticas
CREATE USER IF NOT EXISTS 'ticketing_admin'@'%' IDENTIFIED BY 'admin_pass';
GRANT SELECT, INSERT, UPDATE ON ticketing_db.ESTADIO                    TO 'ticketing_admin'@'%';
GRANT SELECT, INSERT, UPDATE ON ticketing_db.SECTOR                     TO 'ticketing_admin'@'%';
GRANT SELECT, INSERT, UPDATE ON ticketing_db.EQUIPO                     TO 'ticketing_admin'@'%';
GRANT SELECT, INSERT, UPDATE ON ticketing_db.PARTIDO                    TO 'ticketing_admin'@'%';
GRANT SELECT, INSERT, UPDATE ON ticketing_db.SECTOR_PARTIDO             TO 'ticketing_admin'@'%';
GRANT SELECT, INSERT, UPDATE ON ticketing_db.ADMIN_POR_SEDE             TO 'ticketing_admin'@'%';
GRANT SELECT, INSERT, UPDATE ON ticketing_db.FUNCIONARIO_VALIDACION     TO 'ticketing_admin'@'%';
GRANT SELECT, INSERT, UPDATE ON ticketing_db.FUNCIONARIO_SECTOR_PARTIDO TO 'ticketing_admin'@'%';
GRANT SELECT, INSERT, UPDATE ON ticketing_db.DISPOSITIVO                TO 'ticketing_admin'@'%';
GRANT SELECT, INSERT, UPDATE ON ticketing_db.USUARIO                  TO 'ticketing_admin'@'%';
GRANT SELECT, INSERT, UPDATE ON ticketing_db.TELEFONO_USUARIO          TO 'ticketing_admin'@'%';
GRANT SELECT               ON ticketing_db.USUARIO_GENERAL             TO 'ticketing_admin'@'%';
GRANT SELECT               ON ticketing_db.VENTA                       TO 'ticketing_admin'@'%';
GRANT SELECT               ON ticketing_db.ENTRADA                     TO 'ticketing_admin'@'%';
GRANT SELECT               ON ticketing_db.TRANSFERENCIA               TO 'ticketing_admin'@'%';
GRANT SELECT               ON ticketing_db.VALIDACION                  TO 'ticketing_admin'@'%';

-- 3. ticketing_usuario_general: compra, transfiere y consulta sus entradas; ve estadísticas
CREATE USER IF NOT EXISTS 'ticketing_usuario_general'@'%' IDENTIFIED BY 'usuario_pass';
GRANT SELECT, INSERT, UPDATE ON ticketing_db.USUARIO          TO 'ticketing_usuario_general'@'%';
GRANT SELECT, INSERT, UPDATE ON ticketing_db.USUARIO_GENERAL  TO 'ticketing_usuario_general'@'%';
GRANT SELECT, INSERT, UPDATE ON ticketing_db.TELEFONO_USUARIO TO 'ticketing_usuario_general'@'%';
GRANT SELECT, INSERT, UPDATE ON ticketing_db.VENTA            TO 'ticketing_usuario_general'@'%';
GRANT SELECT, INSERT, UPDATE ON ticketing_db.ENTRADA          TO 'ticketing_usuario_general'@'%';
GRANT SELECT, INSERT, UPDATE ON ticketing_db.TRANSFERENCIA    TO 'ticketing_usuario_general'@'%';
GRANT SELECT               ON ticketing_db.PARTIDO            TO 'ticketing_usuario_general'@'%';
GRANT SELECT               ON ticketing_db.SECTOR_PARTIDO     TO 'ticketing_usuario_general'@'%';
GRANT SELECT               ON ticketing_db.ESTADIO            TO 'ticketing_usuario_general'@'%';
GRANT SELECT               ON ticketing_db.SECTOR             TO 'ticketing_usuario_general'@'%';
GRANT SELECT               ON ticketing_db.EQUIPO             TO 'ticketing_usuario_general'@'%';
GRANT SELECT               ON ticketing_db.VALIDACION         TO 'ticketing_usuario_general'@'%';

-- 4. ticketing_funcionario_validacion: escanea QRs y registra validaciones en puerta
CREATE USER IF NOT EXISTS 'ticketing_funcionario_validacion'@'%' IDENTIFIED BY 'funcionario_pass';
GRANT SELECT        ON ticketing_db.ENTRADA                     TO 'ticketing_funcionario_validacion'@'%';
GRANT SELECT        ON ticketing_db.SECTOR_PARTIDO              TO 'ticketing_funcionario_validacion'@'%';
GRANT SELECT        ON ticketing_db.PARTIDO                     TO 'ticketing_funcionario_validacion'@'%';
GRANT SELECT        ON ticketing_db.ESTADIO                     TO 'ticketing_funcionario_validacion'@'%';
GRANT SELECT        ON ticketing_db.FUNCIONARIO_VALIDACION      TO 'ticketing_funcionario_validacion'@'%';
GRANT SELECT        ON ticketing_db.FUNCIONARIO_SECTOR_PARTIDO  TO 'ticketing_funcionario_validacion'@'%';
GRANT SELECT        ON ticketing_db.DISPOSITIVO                 TO 'ticketing_funcionario_validacion'@'%';
GRANT INSERT        ON ticketing_db.VALIDACION                  TO 'ticketing_funcionario_validacion'@'%';
GRANT UPDATE        ON ticketing_db.ENTRADA                     TO 'ticketing_funcionario_validacion'@'%';

FLUSH PRIVILEGES;
