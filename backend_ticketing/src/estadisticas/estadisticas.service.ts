import { Injectable } from '@nestjs/common';
import { Role } from '../auth/roles.enum';
import { DatabaseService } from '../database/database.service';

type MasVendidoRow = {
  id: number;
  equipo_pais_local: string;
  equipo_pais_visitante: string;
  fecha_hora: Date | string;
  estadio: string;
  total_entradas_vendidas: number;
  ingreso_total: string | number;
};

type MayorCompradorRow = {
  mail: string;
  dir_pais: string;
  dir_localidad: string;
  cant_compras: number;
};

type SectorPopularRow = {
  nombre_sector: string;
  id_estadio: number;
  estadio_nombre: string;
  total_vendidas: number;
  capacidad_max: number;
};

@Injectable()
export class EstadisticasService {
  constructor(private readonly databaseService: DatabaseService) {}

  private toMasVendido(row: MasVendidoRow) {
    return {
      id: row.id,
      equipo_pais_local: row.equipo_pais_local,
      equipo_pais_visitante: row.equipo_pais_visitante,
      fecha_hora: row.fecha_hora,
      estadio: row.estadio,
      total_entradas_vendidas: Number(row.total_entradas_vendidas),
      ingreso_total: Number(row.ingreso_total),
    };
  }

  private toSectorPopular(row: SectorPopularRow) {
    return {
      nombre_sector: row.nombre_sector,
      id_estadio: row.id_estadio,
      estadio: row.estadio_nombre,
      total_vendidas: Number(row.total_vendidas),
      capacidad_max: row.capacidad_max,
    };
  }

  private toMayorComprador(row: MayorCompradorRow) {
    return {
      mail: row.mail,
      dir_pais: row.dir_pais,
      dir_localidad: row.dir_localidad,
      cant_compras: Number(row.cant_compras),
    };
  }

  private async getPartidosVendidos(role: Role, direction: 'DESC' | 'ASC') {
    const rows = await this.databaseService.query<MasVendidoRow>(
      `SELECT p.id_evento AS id,
              p.equipo_pais_local,
              p.equipo_pais_visitante,
              p.fecha_hora,
              est.nombre AS estadio,
              COALESCE(v.total_vendidas, 0) AS total_entradas_vendidas,
              COALESCE(v.ingreso_total, 0) AS ingreso_total
       FROM PARTIDO p
       JOIN ESTADIO est ON est.id_estadio = p.id_estadio
       LEFT JOIN (
         SELECT en.sectorpartido_id_evento,
                COUNT(*) AS total_vendidas,
                SUM(sp.costo_entrada) AS ingreso_total
         FROM ENTRADA en
         JOIN SECTOR_PARTIDO sp
           ON sp.partido_id_evento    = en.sectorpartido_id_evento
          AND sp.sector_nombre_sector = en.sectorpartido_nombre_sector
          AND sp.sector_id_estadio    = en.sectorpartido_id_estadio
         WHERE en.activo = TRUE
           AND sp.activo = TRUE
         GROUP BY en.sectorpartido_id_evento
       ) v ON v.sectorpartido_id_evento = p.id_evento
       WHERE p.activo = TRUE
       ORDER BY total_entradas_vendidas ${direction}
       LIMIT 10`,
      [],
      role,
    );

    return rows.map((r) => this.toMasVendido(r));
  }

  async masVendidos(role: Role) {
    return this.getPartidosVendidos(role, 'DESC');
  }

  async menosVendidos(role: Role) {
    return this.getPartidosVendidos(role, 'ASC');
  }

  async sectoresMasPopulares(role: Role) {
    const rows = await this.databaseService.query<SectorPopularRow>(
      `SELECT s.nombre_sector,
              s.id_estadio,
              e.nombre AS estadio_nombre,
              COUNT(en.id_boleto) AS total_vendidas,
              s.capacidad_max
       FROM SECTOR s
       JOIN ESTADIO e ON e.id_estadio = s.id_estadio AND e.activo = TRUE
       LEFT JOIN SECTOR_PARTIDO sp
         ON sp.sector_nombre_sector = s.nombre_sector
        AND sp.sector_id_estadio    = s.id_estadio
        AND sp.activo = TRUE
       LEFT JOIN ENTRADA en
         ON en.sectorpartido_nombre_sector = sp.sector_nombre_sector
        AND en.sectorpartido_id_estadio    = sp.sector_id_estadio
        AND en.sectorpartido_id_evento     = sp.partido_id_evento
        AND en.activo = TRUE
       WHERE s.activo = TRUE
       GROUP BY s.nombre_sector, s.id_estadio, e.nombre, s.capacidad_max
       ORDER BY total_vendidas DESC
       LIMIT 10`,
      [],
      role,
    );

    return rows.map((r) => this.toSectorPopular(r));
  }

  async mayoresCompradores(role: Role) {
    const rows = await this.databaseService.query<MayorCompradorRow>(
      `SELECT u.mail,
              u.dir_pais,
              u.dir_localidad,
              COUNT(v.id_venta) AS cant_compras
       FROM USUARIO u
       JOIN VENTA v ON v.id_usuario = u.id_usuario AND v.activo = TRUE
       WHERE u.activo = TRUE
       GROUP BY u.mail, u.dir_pais, u.dir_localidad
       ORDER BY cant_compras DESC
       LIMIT 10`,
      [],
      role,
    );

    return rows.map((r) => this.toMayorComprador(r));
  }

  async masVendidosPasados(role: Role) {
    const rows = await this.databaseService.query<MasVendidoRow>(
      `SELECT p.id_evento AS id,
              p.equipo_pais_local,
              p.equipo_pais_visitante,
              p.fecha_hora,
              est.nombre AS estadio,
              COALESCE(v.total_vendidas, 0) AS total_entradas_vendidas,
              COALESCE(v.ingreso_total, 0) AS ingreso_total
       FROM PARTIDO p
       JOIN ESTADIO est ON est.id_estadio = p.id_estadio
       LEFT JOIN (
         SELECT en.sectorpartido_id_evento,
                COUNT(*) AS total_vendidas,
                SUM(sp.costo_entrada) AS ingreso_total
         FROM ENTRADA en
         JOIN SECTOR_PARTIDO sp
           ON sp.partido_id_evento    = en.sectorpartido_id_evento
          AND sp.sector_nombre_sector = en.sectorpartido_nombre_sector
          AND sp.sector_id_estadio    = en.sectorpartido_id_estadio
         WHERE en.activo = FALSE
           AND sp.activo = FALSE
         GROUP BY en.sectorpartido_id_evento
       ) v ON v.sectorpartido_id_evento = p.id_evento
       WHERE p.activo = TRUE
       ORDER BY total_entradas_vendidas DESC
       LIMIT 10`,
      [],
      role,
    );

    return rows.map((r) => this.toMasVendido(r));
  }
}
