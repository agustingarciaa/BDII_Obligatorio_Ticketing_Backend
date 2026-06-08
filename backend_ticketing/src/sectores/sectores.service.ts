import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
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

@Injectable()
export class SectoresService {
  constructor(private readonly databaseService: DatabaseService) {}

  private normalizeNombre(nombre?: string) {
    return nombre?.trim() ?? '';
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

  async create(dto: CreateSectorDto, _role: Role) {
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

  async update(id: number, dto: UpdateSectorDto, _role: Role) {
    const nombre = this.normalizeNombre(dto.nombre_sector);

    if (!nombre && dto.capacidad_max === undefined) {
      throw new BadRequestException('Nada para actualizar.');
    }

    if (nombre) {
      const dupRows = await this.databaseService.query<SectorRow>(
        'SELECT nombre_sector FROM SECTOR WHERE nombre_sector = ? AND id_estadio = ? LIMIT 1',
        [nombre, id],
      );

      if (dupRows.length) {
        throw new ConflictException(
          'Ya existe un sector con ese nombre en el estadio.',
        );
      }
    }

    if (dto.capacidad_max !== undefined) {
      await this.databaseService.query(
        'UPDATE SECTOR SET capacidad_max = ? WHERE id_estadio = ? AND activo = TRUE',
        [dto.capacidad_max, id],
      );
    }

    return {
      id_estadio: id,
      nombre_sector: nombre || undefined,
      capacidad_max: dto.capacidad_max,
    };
  }

  async remove(id: number, nombre_sector?: string, _role?: Role) {
    const nombre = this.normalizeNombre(nombre_sector);

    if (nombre) {
      const existingRows = await this.databaseService.query<SectorRow>(
        'SELECT nombre_sector FROM SECTOR WHERE nombre_sector = ? AND id_estadio = ? AND activo = TRUE LIMIT 1',
        [nombre, id],
      );

      if (!existingRows.length) {
        throw new NotFoundException(
          'No existe ese sector activo en el estadio.',
        );
      }

      await this.databaseService.query(
        'UPDATE SECTOR SET activo = FALSE WHERE nombre_sector = ? AND id_estadio = ?',
        [nombre, id],
      );

      return {
        nombre_sector: nombre,
        id_estadio: id,
        deleted: true,
      };
    }

    await this.databaseService.query(
      'UPDATE SECTOR SET activo = FALSE WHERE id_estadio = ?',
      [id],
    );

    return {
      id_estadio: id,
      deleted: true,
    };
  }

  async misSectores(_funcionarioId: number, _role: Role) {
    const rows = await this.databaseService.query<SectorRow>(
      'SELECT s.nombre_sector, s.id_estadio, s.capacidad_max, s.activo FROM SECTOR s JOIN FUNCIONARIO_SECTOR_PARTIDO f ON f.sectorpartido_nombre_sector = s.nombre_sector AND f.sectorpartido_id_estadio = s.id_estadio WHERE f.funcionario_id_usuario = ? AND f.activo = TRUE',
      [_funcionarioId],
    );

    return rows.map((r) => ({
      nombre_sector: r.nombre_sector,
      id_estadio: r.id_estadio,
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
