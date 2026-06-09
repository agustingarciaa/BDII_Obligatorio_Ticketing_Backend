import { Injectable } from '@nestjs/common';
import { Role } from '../auth/roles.enum';
import { CreateEstadioDto, UpdateEstadioDto } from './estadios.dto';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class EstadiosService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(_role: Role) {
    const stadiums = await this.databaseService.query(
      'SELECT * FROM estadio',
      [],
      _role,
    );
    return stadiums;
  }

  async findOne(_id: number, _role: Role) {
    const stadium = await this.databaseService.query(
      `SELECT * FROM estadio WHERE id = ?`,
      [_id],
      _role,
    );
    return stadium[0];
  }

  async create(_dto: CreateEstadioDto, _role: Role) {
    const query = 'INSERT INTO estadio (nombre, pais, ciudad) VALUES (?, ?, ?)';
    const params = [_dto.nombre, _dto.pais, _dto.ciudad];
    await this.databaseService.query(query, params, _role);
    return { message: 'Estadio creado correctamente' };
  }

  async update(_id: number, _dto: UpdateEstadioDto, _role: Role) {
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
    if (_dto.capacidad !== undefined) {
      updates.push('capacidad = ?');
      params.push(_dto.capacidad);
    }

    if (updates.length === 0) {
      return { message: 'No hay campos para actualizar' };
    }

    params.push(_id);
    const query = `UPDATE estadio SET ${updates.join(', ')} WHERE id = ?`;
    await this.databaseService.query(query, params as any[], _role);
    return { message: 'Estadio actualizado correctamente' };
  }

  async remove(_id: number, _role: Role) {}
}
