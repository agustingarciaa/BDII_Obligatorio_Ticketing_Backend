import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '../auth/roles.enum';
import { CreateEstadioDto, UpdateEstadioDto } from './estadios.dto';
import { DatabaseService } from 'src/database/database.service';

type EstadioRow = {
  id_estadio: number;
  nombre: string;
  pais: string;
  ciudad: string;
  activo: number | boolean;
};
@Injectable()
export class EstadiosService {
  constructor(private readonly databaseService: DatabaseService) {}

  private stadiumFormat(row: EstadioRow) {
    return {
      id_estadio: row.id_estadio,
      nombre: row.nombre,
      pais: row.pais,
      ciudad: row.ciudad,
      activo: Boolean(row.activo),
    };
  }

  async findAll(_role: Role) {
    const stadiums = await this.databaseService.query<EstadioRow>(
      'SELECT  id_estadio, nombre, pais, ciudad FROM estadio WHERE activo = TRUE ORDER BY nombre',
      [],
      _role,
    );
    return stadiums.map((s) => this.stadiumFormat(s));
  }

  async findOne(_id: number, _role: Role) {
    const [stadium] = await this.databaseService.query<EstadioRow>(
      `SELECT id_estadio, nombre, pais, ciudad FROM estadio WHERE id_estadio = ? AND activo = TRUE`,
      [_id],
      _role,
    );

    if (!stadium) {
      throw new NotFoundException(`No existe un estadio activo con id ${_id}.`);
    }

    return this.stadiumFormat(stadium);
  }

  async create(_dto: CreateEstadioDto, _role: Role) {
    const query = 'INSERT INTO estadio (nombre, pais, ciudad) VALUES (?, ?, ?)';
    const params = [_dto.nombre, _dto.pais, _dto.ciudad];
    await this.databaseService.query(query, params, _role);
    return { message: 'Estadio creado correctamente' };
  }

  async update(_id: number, _dto: UpdateEstadioDto, _role: Role) {
    const [existing] = await this.databaseService.query<EstadioRow>(
      'SELECT id_estadio FROM estadio WHERE id_estadio = ? AND activo = TRUE LIMIT 1',
      [_id],
      _role,
    );

    if (!existing) {
      throw new NotFoundException(`No existe un estadio activo con id ${_id}.`);
    }

    const updates: string[] = [];
    const params: (string | number | undefined)[] = [];

    if (_dto.nombre !== undefined) {
      updates.push('nombre = ?');
      params.push(_dto.nombre);
    }
    if (_dto.pais !== undefined) {
      updates.push('pais = ?');
      params.push(_dto.pais);
    }
    if (_dto.ciudad !== undefined) {
      updates.push('ciudad = ?');
      params.push(_dto.ciudad);
    }

    if (updates.length === 0) {
      return { message: 'No hay campos para actualizar' };
    }

    params.push(_id);
    const query = `UPDATE estadio SET ${updates.join(', ')} WHERE id_estadio = ?`;
    await this.databaseService.query(query, params as any[], _role);
    return { message: 'Estadio actualizado correctamente' };
  }

  async remove(_id: number, _role: Role) {
    const [existing] = await this.databaseService.query<EstadioRow>(
      'SELECT id_estadio FROM estadio WHERE id_estadio = ? AND activo = TRUE LIMIT 1',
      [_id],
      _role,
    );

    if (!existing) {
      throw new NotFoundException(`No existe un estadio activo con id ${_id}.`);
    }
    const query = `UPDATE estadio SET activo = FALSE WHERE id_estadio = ?`;
    await this.databaseService.query(query, [_id], _role);
    return { message: 'Se elimino el estadio', id_estadio: _id, activo: false };
  }
}
