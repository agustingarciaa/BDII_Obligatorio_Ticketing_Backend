import { Injectable } from '@nestjs/common';
import { Role } from '../auth/roles.enum';
import { CreateEquipoDto, UpdateEquipoDto } from './equipos.dto';

@Injectable()
export class EquiposService {
  async findAll(_role: Role) {

  }

  async findOne(_pais: string, _role: Role) {
  }

  async create(_dto: CreateEquipoDto, _role: Role) {
 
  }

  async update(_pais: string, _dto: UpdateEquipoDto, _role: Role) {

  }

  async remove(_pais: string, _role: Role) {

  }
}
