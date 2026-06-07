import { Injectable } from '@nestjs/common';
import { Role } from '../auth/roles.enum';
import {
  CreateSectorDto,
  UpdateSectorDto,
  AsignarFuncionarioSectorDto,
} from './sectores.dto';

@Injectable()
export class SectoresService {
  async findAll(_role: Role) {
    
  }

  async findOne(_id: number, _role: Role) {
    
  }

  async create(_dto: CreateSectorDto, _role: Role) {
    
  }

  async update(_id: number, _dto: UpdateSectorDto, _role: Role) {
 
  }

  async remove(_id: number, _role: Role) {
   
  }

  async misSectores(_funcionarioId: number, _role: Role) {

  }

  async asignarFuncionario(_dto: AsignarFuncionarioSectorDto, _role: Role) {

  }
}
