import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '../auth/roles.enum';
import type { AuthUser } from '../auth/decorators';
import { DatabaseService } from '../database/database.service';
import {
  CreatePartidoDto,
  UpdatePartidoDto,
  HabilitarSectorPartidoDto,
} from './partidos.dto';

type PartidoRow = {
  id: number;
  id_estadio: number;
  equipo_pais_local: string;
  equipo_pais_visitante: string;
  fecha_hora: Date | string;
  activo: number | boolean;
};

type SectorPartidoRow = {
  sector_nombre_sector: string;
  sector_id_estadio: number;
  costo_entrada: string | number;
  capacidad_max: number;
};

@Injectable()
export class PartidosService {
  constructor(private readonly databaseService: DatabaseService) {}

  private toPartido(row: PartidoRow) {
    return {
      id: row.id,
      id_estadio: row.id_estadio,
      equipo_pais_local: row.equipo_pais_local,
      equipo_pais_visitante: row.equipo_pais_visitante,
      fecha_hora: row.fecha_hora,
      activo: Boolean(row.activo),
    };
  }

  private async checkAdminJurisdiction(
    adminUserId: number,
    estadioId: number,
    role: Role,
  ): Promise<{ pais: string }> {
    const [estadio] = await this.databaseService.query<{ pais: string }>(
      'SELECT pais FROM ESTADIO WHERE id_estadio = ? AND activo = TRUE LIMIT 1',
      [estadioId],
      role,
    );
    if (!estadio) {
      throw new NotFoundException(
        `No existe un estadio activo con id ${estadioId}.`,
      );
    }

    const [admin] = await this.databaseService.query<{
      pais_jurisdiccion: string;
    }>(
      'SELECT pais_jurisdiccion FROM ADMIN_POR_SEDE WHERE id_usuario = ? AND activo = TRUE LIMIT 1',
      [adminUserId],
      role,
    );
    if (!admin || admin.pais_jurisdiccion !== estadio.pais) {
      throw new ForbiddenException(
        'No tiene jurisdicción para gestionar eventos en este estadio.',
      );
    }

    return estadio;
  }

  private async checkNoOverlap(
    estadioId: number,
    fechaHora: string | Date,
    role: Role,
    excludeId?: number,
  ) {
    type QP = string | number | boolean | null | Buffer | Date;
    const baseParams: QP[] = [estadioId, fechaHora as QP, fechaHora as QP];
    const excludeClause =
      excludeId !== undefined ? ' AND id_evento != ?' : '';
    if (excludeId !== undefined) baseParams.push(excludeId);

    const [overlap] = await this.databaseService.query<{ id: number }>(
      `SELECT id_evento AS id FROM PARTIDO
       WHERE id_estadio = ?
         AND activo = TRUE
         AND fecha_hora > DATE_SUB(?, INTERVAL 3 HOUR)
         AND fecha_hora < DATE_ADD(?, INTERVAL 3 HOUR)
         ${excludeClause}
       LIMIT 1`,
      baseParams,
      role,
    );
    if (overlap) {
      throw new ConflictException(
        'Ya existe un evento en ese estadio dentro de la ventana de 3 horas.',
      );
    }
  }

  async findAll(role: Role) {
    const partidos = await this.databaseService.query<PartidoRow>(
      'SELECT id_evento AS id, id_estadio, equipo_pais_local, equipo_pais_visitante, fecha_hora, activo FROM PARTIDO WHERE activo = TRUE ORDER BY fecha_hora',
      [],
      role,
    );

    return partidos.map((p) => this.toPartido(p));
  }

  async findOne(id: number, role: Role) {
    const [partido] = await this.databaseService.query<PartidoRow>(
      'SELECT id_evento AS id, id_estadio, equipo_pais_local, equipo_pais_visitante, fecha_hora, activo FROM PARTIDO WHERE id_evento = ? AND activo = TRUE LIMIT 1',
      [id],
      role,
    );

    if (!partido) {
      throw new NotFoundException(`No existe un partido activo con id ${id}.`);
    }

    return this.toPartido(partido);
  }

  async getSectores(partidoId: number, role: Role) {
    const [partido] = await this.databaseService.query<{ id: number }>(
      'SELECT id_evento AS id FROM PARTIDO WHERE id_evento = ? AND activo = TRUE LIMIT 1',
      [partidoId],
      role,
    );

    if (!partido) {
      throw new NotFoundException(
        `No existe un partido activo con id ${partidoId}.`,
      );
    }

    return this.databaseService.query<SectorPartidoRow>(
      `SELECT sp.sector_nombre_sector, sp.sector_id_estadio, sp.costo_entrada, s.capacidad_max
       FROM SECTOR_PARTIDO sp
       JOIN SECTOR s
         ON s.nombre_sector = sp.sector_nombre_sector
        AND s.id_estadio    = sp.sector_id_estadio
       WHERE sp.partido_id_evento = ? AND sp.activo = TRUE`,
      [partidoId],
      role,
    );
  }

  async create(dto: CreatePartidoDto, user: AuthUser) {
    if (dto.equipo_pais_local === dto.equipo_pais_visitante) {
      throw new BadRequestException(
        'El equipo local y visitante no pueden ser el mismo.',
      );
    }

    await this.checkAdminJurisdiction(user.userId, dto.id_estadio, user.role);

    const [localEquipo] = await this.databaseService.query<{ pais: string }>(
      'SELECT pais FROM EQUIPO WHERE pais = ? AND activo = TRUE LIMIT 1',
      [dto.equipo_pais_local],
      user.role,
    );
    if (!localEquipo) {
      throw new NotFoundException(
        `No existe el equipo '${dto.equipo_pais_local}'.`,
      );
    }

    const [visitanteEquipo] = await this.databaseService.query<{
      pais: string;
    }>(
      'SELECT pais FROM EQUIPO WHERE pais = ? AND activo = TRUE LIMIT 1',
      [dto.equipo_pais_visitante],
      user.role,
    );
    if (!visitanteEquipo) {
      throw new NotFoundException(
        `No existe el equipo '${dto.equipo_pais_visitante}'.`,
      );
    }

    // el overlap de partidos en el mismo estadio no puede ser, aunque sea con otro equipo, dentro de la ventana de 3 horas antes o después del partido nuevo
    await this.checkNoOverlap(dto.id_estadio, dto.fecha_hora, user.role);

    const result = await this.databaseService.query<{ insertId: number }>(
      'INSERT INTO PARTIDO (id_estadio, equipo_pais_local, equipo_pais_visitante, fecha_hora, activo, admin_id_usuario) VALUES (?, ?, ?, ?, TRUE, ?)',
      [
        dto.id_estadio,
        dto.equipo_pais_local,
        dto.equipo_pais_visitante,
        dto.fecha_hora,
        user.userId,
      ],
      user.role,
    );

    const insertId = (result as unknown as { insertId: number }).insertId;

    const [created] = await this.databaseService.query<PartidoRow>(
      'SELECT id_evento AS id, id_estadio, equipo_pais_local, equipo_pais_visitante, fecha_hora, activo FROM PARTIDO WHERE id_evento = ? LIMIT 1',
      [insertId],
      user.role,
    );

    return this.toPartido(created);
  }

  async update(id: number, dto: UpdatePartidoDto, user: AuthUser) {
    const [existing] = await this.databaseService.query<PartidoRow>(
      'SELECT id_evento AS id, id_estadio, equipo_pais_local, equipo_pais_visitante, fecha_hora, activo FROM PARTIDO WHERE id_evento = ? AND activo = TRUE LIMIT 1',
      [id],
      user.role,
    );

    if (!existing) {
      throw new NotFoundException(`No existe un partido activo con id ${id}.`);
    }

    const effectiveEstadioId = dto.id_estadio ?? existing.id_estadio;
    const local = dto.equipo_pais_local ?? existing.equipo_pais_local;
    const visitante =
      dto.equipo_pais_visitante ?? existing.equipo_pais_visitante;
    const fechaHora = dto.fecha_hora ?? existing.fecha_hora;

    if (local === visitante) {
      throw new BadRequestException(
        'El equipo local y visitante no pueden ser el mismo.',
      );
    }

    // Verify new team values exist in EQUIPO table
    if (dto.equipo_pais_local !== undefined) {
      const [eq] = await this.databaseService.query<{ pais: string }>(
        'SELECT pais FROM EQUIPO WHERE pais = ? AND activo = TRUE LIMIT 1',
        [dto.equipo_pais_local],
        user.role,
      );
      if (!eq) {
        throw new NotFoundException(
          `No existe el equipo '${dto.equipo_pais_local}'.`,
        );
      }
    }

    if (dto.equipo_pais_visitante !== undefined) {
      const [eq] = await this.databaseService.query<{ pais: string }>(
        'SELECT pais FROM EQUIPO WHERE pais = ? AND activo = TRUE LIMIT 1',
        [dto.equipo_pais_visitante],
        user.role,
      );
      if (!eq) {
        throw new NotFoundException(
          `No existe el equipo '${dto.equipo_pais_visitante}'.`,
        );
      }
    }


    if (dto.id_estadio !== undefined && dto.id_estadio !== existing.id_estadio) {
      const [sectorCount] = await this.databaseService.query<{ n: number }>(
        'SELECT COUNT(*) AS n FROM SECTOR_PARTIDO WHERE partido_id_evento = ? AND activo = TRUE',
        [id],
        user.role,
      );
      if (sectorCount.n > 0) {
        throw new BadRequestException(
          'No se puede cambiar el estadio de un partido que ya tiene sectores habilitados.',
        );
      }
    }

    // Chequeo lo de la jurisdicción
    await this.checkAdminJurisdiction(user.userId, effectiveEstadioId, user.role);

    // Prevent overlapping events if stadium or time is changing (3-hour window)
    if (dto.id_estadio !== undefined || dto.fecha_hora !== undefined) {
      await this.checkNoOverlap(
        effectiveEstadioId,
        fechaHora as string,
        user.role,
        id,
      );
    }

    await this.databaseService.query(
      `UPDATE PARTIDO
       SET id_estadio = COALESCE(?, id_estadio),
           equipo_pais_local = COALESCE(?, equipo_pais_local),
           equipo_pais_visitante = COALESCE(?, equipo_pais_visitante),
           fecha_hora = COALESCE(?, fecha_hora)
       WHERE id_evento = ? AND activo = TRUE`,
      [
        dto.id_estadio ?? null,
        dto.equipo_pais_local ?? null,
        dto.equipo_pais_visitante ?? null,
        dto.fecha_hora ?? null,
        id,
      ],
      user.role,
    );

    const [updated] = await this.databaseService.query<PartidoRow>(
      'SELECT id_evento AS id, id_estadio, equipo_pais_local, equipo_pais_visitante, fecha_hora, activo FROM PARTIDO WHERE id_evento = ? LIMIT 1',
      [id],
      user.role,
    );

    return this.toPartido(updated);
  }

  async remove(id: number, user: AuthUser) {
    const [existing] = await this.databaseService.query<{
      id: number;
      id_estadio: number;
    }>(
      'SELECT id_evento AS id, id_estadio FROM PARTIDO WHERE id_evento = ? AND activo = TRUE LIMIT 1',
      [id],
      user.role,
    );

    if (!existing) {
      throw new NotFoundException(`No existe un partido activo con id ${id}.`);
    }

    await this.checkAdminJurisdiction(
      user.userId,
      existing.id_estadio,
      user.role,
    );

    await this.databaseService.query(
      'UPDATE PARTIDO SET activo = FALSE WHERE id_evento = ?',
      [id],
      user.role,
    );

    return { id, activo: false };
  }

  async habilitarSector(
    partidoId: number,
    dto: HabilitarSectorPartidoDto,
    user: AuthUser,
  ) {
    const [partido] = await this.databaseService.query<{
      id: number;
      id_estadio: number;
    }>(
      'SELECT id_evento AS id, id_estadio FROM PARTIDO WHERE id_evento = ? AND activo = TRUE LIMIT 1',
      [partidoId],
      user.role,
    );

    if (!partido) {
      throw new NotFoundException(
        `No existe un partido activo con id ${partidoId}.`,
      );
    }

    // Sector must belong to the same stadium as the partido
    if (dto.sector_id_estadio !== partido.id_estadio) {
      throw new BadRequestException(
        'El sector no pertenece al estadio del partido.',
      );
    }

    const [sector] = await this.databaseService.query<{
      nombre_sector: string;
    }>(
      'SELECT nombre_sector FROM SECTOR WHERE nombre_sector = ? AND id_estadio = ? AND activo = TRUE LIMIT 1',
      [dto.sector_nombre_sector, dto.sector_id_estadio],
      user.role,
    );
    if (!sector) {
      throw new NotFoundException(
        `No existe el sector '${dto.sector_nombre_sector}' en el estadio ${dto.sector_id_estadio}.`,
      );
    }

    await this.checkAdminJurisdiction(
      user.userId,
      partido.id_estadio,
      user.role,
    );

    const [existing] = await this.databaseService.query<SectorPartidoRow>(
      'SELECT sector_nombre_sector FROM SECTOR_PARTIDO WHERE partido_id_evento = ? AND sector_nombre_sector = ? AND sector_id_estadio = ? LIMIT 1',
      [partidoId, dto.sector_nombre_sector, dto.sector_id_estadio],
      user.role,
    );

    if (existing) {
      throw new ConflictException(
        `El sector ${dto.sector_nombre_sector} ya está habilitado para este partido.`,
      );
    }

    await this.databaseService.query(
      'INSERT INTO SECTOR_PARTIDO (partido_id_evento, sector_nombre_sector, sector_id_estadio, costo_entrada) VALUES (?, ?, ?, ?)',
      [
        partidoId,
        dto.sector_nombre_sector,
        dto.sector_id_estadio,
        dto.costo_entrada,
      ],
      user.role,
    );

    return {
      id_partido: partidoId,
      sector_nombre_sector: dto.sector_nombre_sector,
      sector_id_estadio: dto.sector_id_estadio,
      costo_entrada: dto.costo_entrada,
    };
  }
}
