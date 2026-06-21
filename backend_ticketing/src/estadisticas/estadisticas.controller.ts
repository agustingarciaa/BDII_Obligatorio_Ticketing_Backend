import { Controller, Get } from '@nestjs/common';
import { EstadisticasService } from './estadisticas.service';
import { Roles, CurrentUser } from '../auth/decorators';
import type { AuthUser } from '../auth/decorators';
import { Role } from '../auth/roles.enum';

@Controller('estadisticas')
<<<<<<< HEAD
@Roles(Role.ADMIN)
export class EstadisticasController {
  constructor(private readonly estadisticasService: EstadisticasService) {}

=======
export class EstadisticasController {
  constructor(private readonly estadisticasService: EstadisticasService) {}

  @Roles(Role.CLIENTE, Role.ADMIN)
>>>>>>> main
  @Get('partidos/mas-vendidos')
  masVendidos(@CurrentUser() user: AuthUser) {
    return this.estadisticasService.masVendidos(user.role);
  }

<<<<<<< HEAD
=======
  @Roles(Role.ADMIN)
>>>>>>> main
  @Get('partidos/menos-vendidos')
  menosVendidos(@CurrentUser() user: AuthUser) {
    return this.estadisticasService.menosVendidos(user.role);
  }

<<<<<<< HEAD
=======
  @Roles(Role.ADMIN)
>>>>>>> main
  @Get('sectores/mas-populares')
  sectoresMasPopulares(@CurrentUser() user: AuthUser) {
    return this.estadisticasService.sectoresMasPopulares(user.role);
  }

<<<<<<< HEAD
=======
  @Roles(Role.ADMIN)
>>>>>>> main
  @Get('usuarios/mayores-compradores')
  mayoresCompradores(@CurrentUser() user: AuthUser) {
    return this.estadisticasService.mayoresCompradores(user.role);
  }

<<<<<<< HEAD
=======
  @Roles(Role.ADMIN)
>>>>>>> main
  @Get('equipos/populares')
  equiposPopulares(@CurrentUser() user: AuthUser) {
    return this.estadisticasService.equiposPopulares(user.role);
  }
}
