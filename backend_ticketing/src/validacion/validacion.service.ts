import { Injectable } from '@nestjs/common';
import { Role } from '../auth/roles.enum';
import { ValidarEntradaDto } from './validacion.dto';

@Injectable()
export class ValidacionService {
  async generarQR(_idBoleto: number, _usuarioId: number, _role: Role) {
   
  }

  async escanear(_dto: ValidarEntradaDto, _role: Role) {
    
  }
}
