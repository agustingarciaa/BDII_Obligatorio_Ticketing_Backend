import { Injectable } from '@nestjs/common';
import { Role } from '../auth/roles.enum';

@Injectable()
export class EstadisticasService {
  async masVendidos(_role: Role) {}

  async mayoresCompradores(_role: Role) {}
}
