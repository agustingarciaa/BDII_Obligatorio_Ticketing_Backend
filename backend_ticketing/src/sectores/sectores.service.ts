import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Role } from '../auth/roles.enum';
import {
  CreateSectorDto,
  UpdateSectorDto,
  AsignarFuncionarioSectorDto,
} from './sectores.dto';
import { DatabaseService } from '../database/database.service';

type SectorRow = {
  nombre_sector: string;
  id_estadio: number;
  capacidad_max: number;
  activo: number | boolean;
};

type MisSectorRow = SectorRow & {
  sectorpartido_id_evento: number;
};

@Injectable()
export class SectoresService {
  constructor(private readonly databaseService: DatabaseService) {}

  private normalizeNombre(nombre?: string) {
    return nombre?.trim() ?? '';
  }

  private async validarJurisdiccionAdmin(userId: number, id_estadio: number) {
    const rows = await this.databaseService.query<{ ok: number }>(
      `SELECT 1 AS ok
       FROM ADMIN_POR_SEDE aps
       JOIN ESTADIO e ON e.pais = aps.pais_jurisdiccion
       WHERE aps.id_usuario = ?
         AND e.id_estadio = ?
         AND aps.activo = TRUE
         AND e.activo = TRUE
       LIMIT 1`,
      [userId, id_estadio],
    );

    if (!rows.length) {
      throw new ForbiddenException(
        'No tiene jurisdicción para gestionar sectores de este estadio.',
      );
    }
  }

  async findAll(_role: Role) {
    const rows = await this.databaseService.query<SectorRow>(
      'SELECT nombre_sector, id_estadio, capacidad_max, activo FROM SECTOR WHERE activo = TRUE',
    );

    return rows.map((r) => ({
      nombre_sector: r.nombre_sector,
      id_estadio: r.id_estadio,
      capacidad_max: r.capacidad_max,
      activo: Boolean(r.activo),
    }));
  }

  async findOne(id_estadio: number, _role: Role) {
    const rows = await this.databaseService.query<SectorRow>(
      'SELECT nombre_sector, id_estadio, capacidad_max, activo FROM SECTOR WHERE id_estadio = ? AND activo = TRUE',
      [id_estadio],
    );

    if (!rows.length) {
      throw new NotFoundException(
        `No se encontraron sectores para el estadio ${id_estadio}.`,
      );
    }

    return rows.map((r) => ({
      nombre_sector: r.nombre_sector,
      id_estadio: r.id_estadio,
      capacidad_max: r.capacidad_max,
      activo: Boolean(r.activo),
    }));
  }

  async create(dto: CreateSectorDto, userId: number, _role: Role) {
    await this.validarJurisdiccionAdmin(userId, dto.id_estadio);

    const nombre = this.normalizeNombre(dto.nombre_sector);

    if (!nombre) {
      throw new BadRequestException('El nombre del sector es obligatorio.');
    }

    const [existing] = await this.databaseService.query<SectorRow>(
      'SELECT nombre_sector, id_estadio, activo FROM SECTOR WHERE nombre_sector = ? AND id_estadio = ? LIMIT 1',
      [nombre, dto.id_estadio],
    );

    if (existing?.activo) {
      throw new ConflictException('El sector ya existe para este estadio.');
    }

    if (existing && !existing.activo) {
      await this.databaseService.query(
        'UPDATE SECTOR SET capacidad_max = ?, activo = TRUE WHERE nombre_sector = ? AND id_estadio = ?',
        [dto.capacidad_max, nombre, dto.id_estadio],
      );

      return {
        nombre_sector: nombre,
        id_estadio: dto.id_estadio,
        capacidad_max: dto.capacidad_max,
        activo: true,
      };
    }

    await this.databaseService.query(
      'INSERT INTO SECTOR (nombre_sector, id_estadio, capacidad_max, activo) VALUES (?, ?, ?, TRUE)',
      [nombre, dto.id_estadio, dto.capacidad_max],
    );

    return {
      nombre_sector: nombre,
      id_estadio: dto.id_estadio,
      capacidad_max: dto.capacidad_max,
      activo: true,
    };
  }

  async update(
    id_estadio: number,
    dto: UpdateSectorDto,
    userId: number,
    _role: Role,
  ) {
    await this.validarJurisdiccionAdmin(userId, id_estadio);

    const nombreActual = this.normalizeNombre(dto.nombre_sector_actual);
    const nuevoNombre = this.normalizeNombre(dto.nombre_sector);

    if (!nombreActual) {
      throw new BadRequestException(
        'Debe indicar el nombre actual del sector.',
      );
    }

    if (!nuevoNombre && dto.capacidad_max === undefined) {
      throw new BadRequestException('Nada para actualizar.');
    }

    const [sector] = await this.databaseService.query<SectorRow>(
      `SELECT nombre_sector, id_estadio, capacidad_max, activo
       FROM SECTOR
       WHERE nombre_sector = ? AND id_estadio = ? AND activo = TRUE
       LIMIT 1`,
      [nombreActual, id_estadio],
    );

    if (!sector) {
      throw new NotFoundException('No existe ese sector activo en el estadio.');
    }

    if (nuevoNombre && nuevoNombre !== nombreActual) {
      const dupRows = await this.databaseService.query<SectorRow>(
        `SELECT nombre_sector
         FROM SECTOR
         WHERE nombre_sector = ? AND id_estadio = ? AND activo = TRUE
         LIMIT 1`,
        [nuevoNombre, id_estadio],
      );

      if (dupRows.length) {
        throw new ConflictException(
          'Ya existe un sector con ese nombre en el estadio.',
        );
      }
    }

    if (dto.capacidad_max !== undefined) {
      const [vendidas] = await this.databaseService.query<{ total: number }>(
        `SELECT COUNT(*) AS total
         FROM ENTRADA
         WHERE sectorpartido_nombre_sector = ?
           AND sectorpartido_id_estadio = ?
           AND activo = TRUE`,
        [nombreActual, id_estadio],
      );

      if (dto.capacidad_max < Number(vendidas?.total ?? 0)) {
        throw new BadRequestException(
          'La capacidad no puede ser menor a la cantidad de entradas vendidas para ese sector.',
        );
      }
    }

    await this.databaseService.query(
      `UPDATE SECTOR
       SET nombre_sector = COALESCE(?, nombre_sector),
           capacidad_max = COALESCE(?, capacidad_max)
       WHERE nombre_sector = ? AND id_estadio = ? AND activo = TRUE`,
      [
        nuevoNombre || null,
        dto.capacidad_max ?? null,
        nombreActual,
        id_estadio,
      ],
    );

    return {
      id_estadio,
      nombre_sector_anterior: nombreActual,
      nombre_sector: nuevoNombre || nombreActual,
      capacidad_max: dto.capacidad_max ?? sector.capacidad_max,
      updated: true,
    };
  }

  async remove(
    id_estadio: number,
    nombre_sector: string | undefined,
    userId: number,
    _role: Role,
  ) {
    await this.validarJurisdiccionAdmin(userId, id_estadio);

    const nombre = this.normalizeNombre(nombre_sector);

    if (!nombre) {
      throw new BadRequestException(
        'Debe indicar nombre_sector. No se permite borrar todos los sectores del estadio.',
      );
    }

    const [sector] = await this.databaseService.query<SectorRow>(
      `SELECT nombre_sector
       FROM SECTOR
       WHERE nombre_sector = ? AND id_estadio = ? AND activo = TRUE
       LIMIT 1`,
      [nombre, id_estadio],
    );

    if (!sector) {
      throw new NotFoundException('No existe ese sector activo en el estadio.');
    }

    const [usoEnPartidos] = await this.databaseService.query<{ total: number }>(
      `SELECT COUNT(*) AS total
       FROM SECTOR_PARTIDO
       WHERE sector_nombre_sector = ?
         AND sector_id_estadio = ?
         AND activo = TRUE`,
      [nombre, id_estadio],
    );

    if (Number(usoEnPartidos?.total ?? 0) > 0) {
      throw new ConflictException(
        'No se puede eliminar el sector porque está asociado a partidos activos.',
      );
    }

    const [entradas] = await this.databaseService.query<{ total: number }>(
      `SELECT COUNT(*) AS total
       FROM ENTRADA
       WHERE sectorpartido_nombre_sector = ?
         AND sectorpartido_id_estadio = ?
         AND activo = TRUE`,
      [nombre, id_estadio],
    );

    if (Number(entradas?.total ?? 0) > 0) {
      throw new ConflictException(
        'No se puede eliminar el sector porque tiene entradas asociadas.',
      );
    }

    await this.databaseService.query(
      `UPDATE SECTOR
       SET activo = FALSE
       WHERE nombre_sector = ? AND id_estadio = ?`,
      [nombre, id_estadio],
    );

    return {
      nombre_sector: nombre,
      id_estadio,
      deleted: true,
    };
  }

  async misSectores(funcionarioId: number, _role: Role) {
    const rows = await this.databaseService.query<MisSectorRow>(
      `SELECT 
         s.nombre_sector,
         s.id_estadio,
         s.capacidad_max,
         s.activo,
         f.sectorpartido_id_evento
       FROM SECTOR s
       JOIN FUNCIONARIO_SECTOR_PARTIDO f
         ON f.sectorpartido_nombre_sector = s.nombre_sector
        AND f.sectorpartido_id_estadio = s.id_estadio
       WHERE f.funcionario_id_usuario = ?
         AND f.activo = TRUE
         AND s.activo = TRUE`,
      [funcionarioId],
    );

    return rows.map((r) => ({
      nombre_sector: r.nombre_sector,
      id_estadio: r.id_estadio,
      id_evento: r.sectorpartido_id_evento,
      capacidad_max: r.capacidad_max,
      activo: Boolean(r.activo),
    }));
  }

  async asignarFuncionario(dto: AsignarFuncionarioSectorDto, _role: Role) {
    const {
      funcionario_id_usuario,
      sectorpartido_nombre_sector,
      sectorpartido_id_estadio,
      sectorpartido_id_evento,
    } = dto;

    const existingRows = await this.databaseService.query<{
      funcionario_id_usuario: number;
    }>(
      'SELECT funcionario_id_usuario FROM FUNCIONARIO_SECTOR_PARTIDO WHERE funcionario_id_usuario = ? AND sectorpartido_nombre_sector = ? AND sectorpartido_id_estadio = ? AND sectorpartido_id_evento = ? LIMIT 1',
      [
        funcionario_id_usuario,
        sectorpartido_nombre_sector,
        sectorpartido_id_estadio,
        sectorpartido_id_evento,
      ],
    );

    if (existingRows.length) {
      await this.databaseService.query(
        'UPDATE FUNCIONARIO_SECTOR_PARTIDO SET activo = TRUE WHERE funcionario_id_usuario = ? AND sectorpartido_nombre_sector = ? AND sectorpartido_id_estadio = ? AND sectorpartido_id_evento = ?',
        [
          funcionario_id_usuario,
          sectorpartido_nombre_sector,
          sectorpartido_id_estadio,
          sectorpartido_id_evento,
        ],
      );

      return { assigned: true };
    }

    await this.databaseService.query(
      'INSERT INTO FUNCIONARIO_SECTOR_PARTIDO (funcionario_id_usuario, sectorpartido_nombre_sector, sectorpartido_id_estadio, sectorpartido_id_evento, activo) VALUES (?, ?, ?, ?, TRUE)',
      [
        funcionario_id_usuario,
        sectorpartido_nombre_sector,
        sectorpartido_id_estadio,
        sectorpartido_id_evento,
      ],
    );

    return { assigned: true };
  }
}
