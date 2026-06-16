import { Controller, Get } from '@nestjs/common';
import { EstadisticasService } from './estadisticas.service';
import { Roles, CurrentUser } from '../auth/decorators';
import type { AuthUser } from '../auth/decorators';
import { Role } from '../auth/roles.enum';

@Controller('estadisticas')
@Roles(Role.ADMIN)
export class EstadisticasController {
  constructor(private readonly estadisticasService: EstadisticasService) {}

  @Get('partidos/mas-vendidos')
  masVendidos(@CurrentUser() user: AuthUser) {
    return this.estadisticasService.masVendidos(user.role);
  }

  @Get('partidos/menos-vendidos')
  menosVendidos(@CurrentUser() user: AuthUser) {
    return this.estadisticasService.menosVendidos(user.role);
  }

  @Get('sectores/mas-populares')
  sectoresMasPopulares(@CurrentUser() user: AuthUser) {
    return this.estadisticasService.sectoresMasPopulares(user.role);
  }

  @Get('usuarios/mayores-compradores')
  mayoresCompradores(@CurrentUser() user: AuthUser) {
    return this.estadisticasService.mayoresCompradores(user.role);
  }
}
