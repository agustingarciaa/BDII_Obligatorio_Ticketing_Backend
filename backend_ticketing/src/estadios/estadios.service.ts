import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '../auth/roles.enum';
import { DatabaseService } from '../database/database.service';
import { CreateEstadioDto, UpdateEstadioDto } from './estadios.dto';

type EstadioRow = {
  id_estadio: number;
  nombre: string;
  pais: string;
  ciudad: string;
  activo: number | boolean;
};

type AdminPorSedeRow = {
  pais_jurisdiccion: string;
};

@Injectable()
export class EstadiosService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(userId: number, role: Role) {
    if (role === Role.ADMIN) {
      const jurisdiccion = await this.getPaisJurisdiccion(userId, role);

      const stadiums = await this.databaseService.query<EstadioRow>(
        `SELECT id_estadio, nombre, pais, ciudad, activo
         FROM ESTADIO
         WHERE activo = TRUE
           AND pais = ?
         ORDER BY nombre`,
        [jurisdiccion],
        role,
      );

      return stadiums.map((stadium) => this.stadiumFormat(stadium));
    }

    const stadiums = await this.databaseService.query<EstadioRow>(
      `SELECT id_estadio, nombre, pais, ciudad, activo
       FROM ESTADIO
       WHERE activo = TRUE
       ORDER BY nombre`,
      [],
      role,
    );

    return stadiums.map((stadium) => this.stadiumFormat(stadium));
  }

  async findOne(id: number, userId: number, role: Role) {
    const [stadium] = await this.databaseService.query<EstadioRow>(
      `SELECT id_estadio, nombre, pais, ciudad, activo
       FROM ESTADIO
       WHERE id_estadio = ?
         AND activo = TRUE
       LIMIT 1`,
      [id],
      role,
    );

    if (!stadium) {
      throw new NotFoundException(`No existe un estadio activo con id ${id}.`);
    }

    if (role === Role.ADMIN) {
      await this.validateJurisdiccion(userId, stadium.pais, role);
    }

    return this.stadiumFormat(stadium);
  }

  async create(dto: CreateEstadioDto, userId: number, role: Role) {
    await this.validateJurisdiccion(userId, dto.pais, role);

    await this.databaseService.query(
      `INSERT INTO ESTADIO (nombre, pais, ciudad)
       VALUES (?, ?, ?)`,
      [dto.nombre, dto.pais, dto.ciudad],
      role,
    );

    return { message: 'Estadio creado correctamente' };
  }

  async update(id: number, dto: UpdateEstadioDto, userId: number, role: Role) {
    const [existing] = await this.databaseService.query<EstadioRow>(
      `SELECT id_estadio, pais
       FROM ESTADIO
       WHERE id_estadio = ?
         AND activo = TRUE
       LIMIT 1`,
      [id],
      role,
    );

    if (!existing) {
      throw new NotFoundException(`No existe un estadio activo con id ${id}.`);
    }

    await this.validateJurisdiccion(userId, existing.pais, role);

    if (dto.pais !== undefined) {
      await this.validateJurisdiccion(userId, dto.pais, role);
    }

    const updates: string[] = [];
    const params: (string | number)[] = [];

    if (dto.nombre !== undefined) {
      updates.push('nombre = ?');
      params.push(dto.nombre);
    }

    if (dto.pais !== undefined) {
      updates.push('pais = ?');
      params.push(dto.pais);
    }

    if (dto.ciudad !== undefined) {
      updates.push('ciudad = ?');
      params.push(dto.ciudad);
    }

    if (updates.length === 0) {
      return { message: 'No hay campos para actualizar' };
    }

    params.push(id);

    await this.databaseService.query(
      `UPDATE ESTADIO
       SET ${updates.join(', ')}
       WHERE id_estadio = ?`,
      params,
      role,
    );

    return { message: 'Estadio actualizado correctamente' };
  }

  async remove(id: number, userId: number, role: Role) {
    const [existing] = await this.databaseService.query<EstadioRow>(
      `SELECT id_estadio, pais
       FROM ESTADIO
       WHERE id_estadio = ?
         AND activo = TRUE
       LIMIT 1`,
      [id],
      role,
    );

    if (!existing) {
      throw new NotFoundException(`No existe un estadio activo con id ${id}.`);
    }

    await this.validateJurisdiccion(userId, existing.pais, role);

    await this.databaseService.query(
      `UPDATE ESTADIO
       SET activo = FALSE
       WHERE id_estadio = ?`,
      [id],
      role,
    );

    return {
      message: 'Se eliminó el estadio',
      id_estadio: id,
      activo: false,
    };
  }

  private stadiumFormat(row: EstadioRow) {
    return {
      id_estadio: row.id_estadio,
      nombre: row.nombre,
      pais: row.pais,
      ciudad: row.ciudad,
      activo: Boolean(row.activo),
    };
  }

  private async getPaisJurisdiccion(userId: number, role: Role) {
    const [admin] = await this.databaseService.query<AdminPorSedeRow>(
      `SELECT pais_jurisdiccion
       FROM ADMIN_POR_SEDE
       WHERE id_usuario = ?
         AND activo = TRUE
       LIMIT 1`,
      [userId],
      role,
    );

    if (!admin) {
      throw new ForbiddenException('No tenés una jurisdicción asignada.');
    }

    return admin.pais_jurisdiccion;
  }

  private async validateJurisdiccion(
    userId: number,

    pais: string,
    role: Role,
  ) {
    const jurisdiccion = await this.getPaisJurisdiccion(userId, role);

    if (pais !== jurisdiccion) {
      throw new ForbiddenException(
        'No tenés jurisdicción para operar sobre este estadio.',
      );
    }
  }
}
