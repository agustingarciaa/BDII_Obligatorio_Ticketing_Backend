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

type EquipoPopularRow = {
  pais: string;
  partidos_jugados: number;
  capacidad_total: number;
  entradas_vendidas: number;
  porcentaje_venta: number;
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

  private toEquiposPopulares(row: EquipoPopularRow) {
    return {
      pais: row.pais,
      partidos_jugados: row.partidos_jugados,
      capacidad_total: row.capacidad_total,
      entradas_vendidas: row.entradas_vendidas,
      porcentaje_ventas: row.porcentaje_venta,
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

  async equiposPopulares(role: Role) {
    const rows = await this.databaseService.query<EquipoPopularRow>(
      `SELECT 
    e.pais AS equipo,
    COUNT(DISTINCT p.id_evento) AS partidos_jugados,
    SUM(s.capacidad_max) AS capacidad_total,
    COUNT(ent.id_boleto) AS entradas_vendidas,
    ROUND(
        (COUNT(ent.id_boleto) * 100.0 / NULLIF(SUM(s.capacidad_max), 0)), 
        2
    ) AS porcentaje_venta
    FROM EQUIPO e
    JOIN PARTIDO p ON (p.equipo_pais_local = e.pais OR p.equipo_pais_visitante = e.pais)
        AND p.activo = TRUE
    JOIN SECTOR_PARTIDO sp ON sp.partido_id_evento = p.id_evento AND sp.activo = TRUE
    JOIN SECTOR s ON s.nombre_sector = sp.sector_nombre_sector 
        AND s.id_estadio = sp.sector_id_estadio 
        AND s.activo = TRUE
    LEFT JOIN ENTRADA ent ON ent.sectorpartido_nombre_sector = sp.sector_nombre_sector 
        AND ent.sectorpartido_id_estadio = sp.sector_id_estadio 
        AND ent.sectorpartido_id_evento = sp.partido_id_evento
        AND ent.activo = TRUE
    WHERE e.activo = TRUE
    GROUP BY e.pais
    ORDER BY entradas_vendidas DESC, porcentaje_venta DESC`,
      [],
      role,
    );
    return rows.map((r) => this.toEquiposPopulares(r));
  }
}
