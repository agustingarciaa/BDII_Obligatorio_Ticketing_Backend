import { Injectable } from '@nestjs/common';
import { Role } from '../auth/roles.enum';
import { CreateEstadioDto, UpdateEstadioDto } from './estadios.dto';

@Injectable()
export class EstadiosService {
  async findAll(_role: Role) {

  }

  async findOne(_id: number, _role: Role) {
   
  }

  async create(_dto: CreateEstadioDto, _role: Role) {
    
  }

  async update(_id: number, _dto: UpdateEstadioDto, _role: Role) {
    
  }

  async remove(_id: number, _role: Role) {
    
  }
}
