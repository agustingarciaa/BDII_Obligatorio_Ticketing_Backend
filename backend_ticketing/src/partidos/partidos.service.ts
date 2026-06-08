import { Injectable } from '@nestjs/common';
import { Role } from '../auth/roles.enum';
import {
  CreatePartidoDto,
  UpdatePartidoDto,
  HabilitarSectorPartidoDto,
} from './partidos.dto';

@Injectable()
export class PartidosService {
  async findAll(_role: Role) {
  }

  async findOne(_id: number, _role: Role) {

  }

  async create(_dto: CreatePartidoDto, _role: Role) {
    
  }

  async update(_id: number, _dto: UpdatePartidoDto, _role: Role) {
    
  }

  async remove(_id: number, _role: Role) {
    
  }

  async habilitarSector(
    _partidoId: number,
    _dto: HabilitarSectorPartidoDto,
    _role: Role,
  ) {
    
  }
}
