import { Controller, Get } from '@nestjs/common';
import { EstadisticasService } from './estadisticas.service';
import { Roles, CurrentUser } from '../auth/decorators';
import type { AuthUser } from '../auth/decorators';
import { Role } from '../auth/roles.enum';

@Controller('estadisticas')
export class EstadisticasController {
  constructor(private readonly estadisticasService: EstadisticasService) {}

  @Roles(Role.CLIENTE, Role.ADMIN)
  @Get('partidos/mas-vendidos')
  masVendidos(@CurrentUser() user: AuthUser) {
    return this.estadisticasService.masVendidos(user.role);
  }

  @Roles(Role.ADMIN)
  @Get('partidos/menos-vendidos')
  menosVendidos(@CurrentUser() user: AuthUser) {
    return this.estadisticasService.menosVendidos(user.role);
  }

  @Roles(Role.ADMIN)
  @Get('sectores/mas-populares')
  sectoresMasPopulares(@CurrentUser() user: AuthUser) {
    return this.estadisticasService.sectoresMasPopulares(user.role);
  }

  @Roles(Role.ADMIN)
  @Get('usuarios/mayores-compradores')
  mayoresCompradores(@CurrentUser() user: AuthUser) {
    return this.estadisticasService.mayoresCompradores(user.role);
  }

  @Roles(Role.ADMIN)
  @Get('equipos/populares')
  equiposPopulares(@CurrentUser() user: AuthUser) {
    return this.estadisticasService.equiposPopulares(user.role);
  }
}
