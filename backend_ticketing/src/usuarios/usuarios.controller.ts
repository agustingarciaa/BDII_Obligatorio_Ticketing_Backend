import { Controller, Get, Put, Delete, Body, Query } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { ModificarUsuarioDto } from './usuarios.dto';
import { Roles, CurrentUser } from 'src/auth/decorators';
import type { AuthUser } from 'src/auth/decorators';
import { Role } from '../auth/roles.enum';

@Controller('usuarios')
@Roles(Role.CLIENTE)
export class UsuariosController {
  constructor(private readonly usuarioService: UsuariosService) {}

  @Get('info')
  misDatos(@CurrentUser() user: AuthUser) {
    return this.usuarioService.misDatos(user.userId, user.role);
  }

  @Put('info/modificar')
  modificarDatos(
    @CurrentUser() user: AuthUser,
    @Body() dto: ModificarUsuarioDto,
  ) {
    return this.usuarioService.modificarDatos(user.userId, dto, user.role);
  }

  @Get('buscar')
  buscarPorMail(@Query('mail') mail: string, @CurrentUser() user: AuthUser) {
    return this.usuarioService.buscarPorMail(mail, user.userId, user.role);
  }

  @Delete('eliminar')
  eliminarUsuario(@CurrentUser() user: AuthUser) {
    return this.usuarioService.eliminarUsuario(user.userId, user.role);
  }
}
