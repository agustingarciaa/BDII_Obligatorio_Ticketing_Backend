CREATE DATABASE IF NOT EXISTS ticketing_db;
USE ticketing_db;

CREATE TABLE ESTADIO (
  id_estadio  INT          PRIMARY KEY AUTO_INCREMENT,
  nombre      VARCHAR(100) NOT NULL,
  pais        VARCHAR(50)  NOT NULL,
  ciudad      VARCHAR(100) NOT NULL
);

CREATE TABLE SECTOR (
  nombre_sector  VARCHAR(50) NOT NULL,
  est_id_estadio INT         NOT NULL,
  capacidad_max  INT         NOT NULL,
  PRIMARY KEY (nombre_sector, est_id_estadio),
  FOREIGN KEY (est_id_estadio) REFERENCES ESTADIO(id_estadio) ON DELETE CASCADE
);

CREATE TABLE EQUIPO (
  pais VARCHAR(50) PRIMARY KEY
);

CREATE TABLE USUARIO (
  doc_pais            VARCHAR(50)  NOT NULL,
  doc_tipo            VARCHAR(50)  NOT NULL,
  doc_numero          VARCHAR(50)  NOT NULL,
  mail                VARCHAR(100) NOT NULL UNIQUE,
  contrasena_hasheada VARCHAR(255) NOT NULL,
  dir_pais            VARCHAR(50)  NOT NULL,
  dir_localidad       VARCHAR(100) NOT NULL,
  dir_calle           VARCHAR(100) NOT NULL,
  dir_numero          INT          NOT NULL,
  dir_codigo_postal   VARCHAR(20)  NOT NULL,
  PRIMARY KEY (doc_pais, doc_tipo, doc_numero)
);

CREATE TABLE TELEFONO_USUARIO (
  usu_doc_pais   VARCHAR(50) NOT NULL,
  usu_doc_tipo   VARCHAR(50) NOT NULL,
  usu_doc_numero VARCHAR(50) NOT NULL,
  telefono       VARCHAR(20) NOT NULL,
  PRIMARY KEY (usu_doc_pais, usu_doc_tipo, usu_doc_numero, telefono),
  FOREIGN KEY (usu_doc_pais, usu_doc_tipo, usu_doc_numero)
    REFERENCES USUARIO(doc_pais, doc_tipo, doc_numero) ON DELETE CASCADE
);

CREATE TABLE ADMIN_POR_SEDE (
  usu_doc_pais      VARCHAR(50) NOT NULL,
  usu_doc_tipo      VARCHAR(50) NOT NULL,
  usu_doc_numero    VARCHAR(50) NOT NULL,
  pais_jurisdiccion VARCHAR(50) NOT NULL,
  fecha_asignacion  DATETIME    NOT NULL,
  PRIMARY KEY (usu_doc_pais, usu_doc_tipo, usu_doc_numero),
  FOREIGN KEY (usu_doc_pais, usu_doc_tipo, usu_doc_numero)
    REFERENCES USUARIO(doc_pais, doc_tipo, doc_numero) ON DELETE CASCADE
);

CREATE TABLE FUNCIONARIO_VALIDACION (
  usu_doc_pais   VARCHAR(50) NOT NULL,
  usu_doc_tipo   VARCHAR(50) NOT NULL,
  usu_doc_numero VARCHAR(50) NOT NULL,
  numero_legajo  INT         NOT NULL UNIQUE,
  PRIMARY KEY (usu_doc_pais, usu_doc_tipo, usu_doc_numero),
  FOREIGN KEY (usu_doc_pais, usu_doc_tipo, usu_doc_numero)
    REFERENCES USUARIO(doc_pais, doc_tipo, doc_numero) ON DELETE CASCADE
);

CREATE TABLE DISPOSITIVO (
  id_dispositivo INT         PRIMARY KEY AUTO_INCREMENT,
  fun_doc_pais   VARCHAR(50) NOT NULL,
  fun_doc_tipo   VARCHAR(50) NOT NULL,
  fun_doc_numero VARCHAR(50) NOT NULL,
  UNIQUE (fun_doc_pais, fun_doc_tipo, fun_doc_numero),
  FOREIGN KEY (fun_doc_pais, fun_doc_tipo, fun_doc_numero)
    REFERENCES FUNCIONARIO_VALIDACION(usu_doc_pais, usu_doc_tipo, usu_doc_numero) ON DELETE RESTRICT
);

CREATE TABLE USUARIO_GENERAL (
  usu_doc_pais        VARCHAR(50) NOT NULL,
  usu_doc_tipo        VARCHAR(50) NOT NULL,
  usu_doc_numero      VARCHAR(50) NOT NULL,
  fecha_registro      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado_verificacion VARCHAR(50) NOT NULL DEFAULT 'pendiente',
  PRIMARY KEY (usu_doc_pais, usu_doc_tipo, usu_doc_numero),
  FOREIGN KEY (usu_doc_pais, usu_doc_tipo, usu_doc_numero)
    REFERENCES USUARIO(doc_pais, doc_tipo, doc_numero) ON DELETE CASCADE
);

CREATE TABLE PARTIDO (
  id_evento         INT         PRIMARY KEY AUTO_INCREMENT,
  fecha_hora        DATETIME    NOT NULL,
  est_id_estadio    INT         NOT NULL,
  eq_pais_local     VARCHAR(50) NOT NULL,
  eq_pais_visitante VARCHAR(50) NOT NULL,
  adm_doc_pais      VARCHAR(50) NULL,
  adm_doc_tipo      VARCHAR(50) NULL,
  adm_doc_numero    VARCHAR(50) NULL,
  UNIQUE (est_id_estadio, fecha_hora),
  FOREIGN KEY (est_id_estadio)    REFERENCES ESTADIO(id_estadio) ON DELETE RESTRICT,
  FOREIGN KEY (eq_pais_local)     REFERENCES EQUIPO(pais)        ON DELETE RESTRICT,
  FOREIGN KEY (eq_pais_visitante) REFERENCES EQUIPO(pais)        ON DELETE RESTRICT,
  FOREIGN KEY (adm_doc_pais, adm_doc_tipo, adm_doc_numero)
    REFERENCES ADMIN_POR_SEDE(usu_doc_pais, usu_doc_tipo, usu_doc_numero) ON DELETE SET NULL
);

CREATE TABLE SECTOR_PARTIDO (
  sec_nombre_sector VARCHAR(50)    NOT NULL,
  sec_id_estadio    INT            NOT NULL,
  par_id_evento     INT            NOT NULL,
  costo_entrada     DECIMAL(10, 2) NOT NULL,
  PRIMARY KEY (sec_nombre_sector, sec_id_estadio, par_id_evento),
  FOREIGN KEY (sec_nombre_sector, sec_id_estadio)
    REFERENCES SECTOR(nombre_sector, est_id_estadio) ON DELETE CASCADE,
  FOREIGN KEY (par_id_evento) REFERENCES PARTIDO(id_evento) ON DELETE CASCADE
);

CREATE TABLE FUNCIONARIO_SECTOR_PARTIDO (
  fun_doc_pais     VARCHAR(50) NOT NULL,
  fun_doc_tipo     VARCHAR(50) NOT NULL,
  fun_doc_numero   VARCHAR(50) NOT NULL,
  sp_nombre_sector VARCHAR(50) NOT NULL,
  sp_id_estadio    INT         NOT NULL,
  sp_id_evento     INT         NOT NULL,
  PRIMARY KEY (fun_doc_pais, fun_doc_tipo, fun_doc_numero, sp_nombre_sector, sp_id_estadio, sp_id_evento),
  FOREIGN KEY (fun_doc_pais, fun_doc_tipo, fun_doc_numero)
    REFERENCES FUNCIONARIO_VALIDACION(usu_doc_pais, usu_doc_tipo, usu_doc_numero) ON DELETE CASCADE,
  FOREIGN KEY (sp_nombre_sector, sp_id_estadio, sp_id_evento)
    REFERENCES SECTOR_PARTIDO(sec_nombre_sector, sec_id_estadio, par_id_evento) ON DELETE CASCADE
);

CREATE TABLE VENTA (
  id_venta       INT            PRIMARY KEY AUTO_INCREMENT,
  fecha          DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado         VARCHAR(50)    NOT NULL DEFAULT 'pendiente',
  monto_total    DECIMAL(10, 2) NOT NULL,
  tasa_comision  DECIMAL(5, 4)  NOT NULL DEFAULT 0.0500,
  usu_doc_pais   VARCHAR(50)    NOT NULL,
  usu_doc_tipo   VARCHAR(50)    NOT NULL,
  usu_doc_numero VARCHAR(50)    NOT NULL,
  FOREIGN KEY (usu_doc_pais, usu_doc_tipo, usu_doc_numero)
    REFERENCES USUARIO_GENERAL(usu_doc_pais, usu_doc_tipo, usu_doc_numero) ON DELETE RESTRICT
);

CREATE TABLE ENTRADA (
  id_boleto          INT          PRIMARY KEY AUTO_INCREMENT,
  estado             VARCHAR(50)  NOT NULL DEFAULT 'activo',
  qr_token_actual    VARCHAR(255) NULL,
  qr_token_expira_en DATETIME     NULL,
  ven_id_venta       INT          NOT NULL,
  sp_nombre_sector   VARCHAR(50)  NOT NULL,
  sp_id_estadio      INT          NOT NULL,
  sp_id_evento       INT          NOT NULL,
  prop_doc_pais      VARCHAR(50)  NOT NULL,
  prop_doc_tipo      VARCHAR(50)  NOT NULL,
  prop_doc_numero    VARCHAR(50)  NOT NULL,
  FOREIGN KEY (ven_id_venta) REFERENCES VENTA(id_venta) ON DELETE RESTRICT,
  FOREIGN KEY (sp_nombre_sector, sp_id_estadio, sp_id_evento)
    REFERENCES SECTOR_PARTIDO(sec_nombre_sector, sec_id_estadio, par_id_evento) ON DELETE RESTRICT,
  FOREIGN KEY (prop_doc_pais, prop_doc_tipo, prop_doc_numero)
    REFERENCES USUARIO_GENERAL(usu_doc_pais, usu_doc_tipo, usu_doc_numero) ON DELETE RESTRICT
);

CREATE TABLE TRANSFERENCIA (
  id_transferencia   INT         PRIMARY KEY AUTO_INCREMENT,
  fecha              DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado             VARCHAR(50) NOT NULL DEFAULT 'pendiente',
  ent_id_boleto      INT         NOT NULL,
  origen_doc_pais    VARCHAR(50) NOT NULL,
  origen_doc_tipo    VARCHAR(50) NOT NULL,
  origen_doc_numero  VARCHAR(50) NOT NULL,
  destino_doc_pais   VARCHAR(50) NOT NULL,
  destino_doc_tipo   VARCHAR(50) NOT NULL,
  destino_doc_numero VARCHAR(50) NOT NULL,
  FOREIGN KEY (ent_id_boleto) REFERENCES ENTRADA(id_boleto) ON DELETE RESTRICT,
  FOREIGN KEY (origen_doc_pais, origen_doc_tipo, origen_doc_numero)
    REFERENCES USUARIO_GENERAL(usu_doc_pais, usu_doc_tipo, usu_doc_numero) ON DELETE RESTRICT,
  FOREIGN KEY (destino_doc_pais, destino_doc_tipo, destino_doc_numero)
    REFERENCES USUARIO_GENERAL(usu_doc_pais, usu_doc_tipo, usu_doc_numero) ON DELETE RESTRICT
);

CREATE TABLE VALIDACION (
  qr_usado           VARCHAR(255) PRIMARY KEY,
  fecha              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dis_id_dispositivo INT          NOT NULL,
  fun_doc_pais       VARCHAR(50)  NOT NULL,
  fun_doc_tipo       VARCHAR(50)  NOT NULL,
  fun_doc_numero     VARCHAR(50)  NOT NULL,
  ent_id_boleto      INT          NOT NULL UNIQUE,
  FOREIGN KEY (dis_id_dispositivo) REFERENCES DISPOSITIVO(id_dispositivo)  ON DELETE RESTRICT,
  FOREIGN KEY (fun_doc_pais, fun_doc_tipo, fun_doc_numero)
    REFERENCES FUNCIONARIO_VALIDACION(usu_doc_pais, usu_doc_tipo, usu_doc_numero) ON DELETE RESTRICT,
  FOREIGN KEY (ent_id_boleto) REFERENCES ENTRADA(id_boleto) ON DELETE RESTRICT
);
