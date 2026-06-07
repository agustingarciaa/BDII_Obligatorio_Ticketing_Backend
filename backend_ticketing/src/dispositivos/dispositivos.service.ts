import { Injectable } from '@nestjs/common';
import { Role } from '../auth/roles.enum';
import { CreateDispositivoDto } from './dispositivos.dto';

@Injectable()
export class DispositivosService {
  async findAll(_role: Role) {
  
  }

  async findOne(_id: number, _role: Role) {
    
  }

  async create(_dto: CreateDispositivoDto, _role: Role) {
    
  }

  async remove(_id: number, _role: Role) {
    
  }
}
