import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { EntradasService } from './entradas.service';
import { ComprarEntradaDto, TransferirEntradaDto } from './entradas.dto';
import { Roles, CurrentUser } from '../auth/decorators';
import type { AuthUser } from '../auth/decorators';
import { Role } from '../auth/roles.enum';

@Controller('entradas')
@Roles(Role.CLIENTE)
export class EntradasController {
  constructor(private readonly entradasService: EntradasService) {}

  @Get('mis-entradas')
  misEntradas(@CurrentUser() user: AuthUser) {
    return this.entradasService.misEntradas(user.userId, user.role);
  }

  @Get('mis-compras')
  misCompras(@CurrentUser() user: AuthUser) {
    return this.entradasService.misCompras(user.userId, user.role);
  }

  @Get('mis-transferencias')
  misTransferencias(@CurrentUser() user: AuthUser) {
    return this.entradasService.misTransferencias(user.userId, user.role);
  }

  @Post('comprar')
  comprar(@CurrentUser() user: AuthUser, @Body() dto: ComprarEntradaDto) {
    return this.entradasService.comprar(user.userId, dto, user.role);
  }

  @Post('transferir')
  transferir(@CurrentUser() user: AuthUser, @Body() dto: TransferirEntradaDto) {
    return this.entradasService.transferir(user.userId, dto, user.role);
  }

  @Put('transferencias/:id/aceptar')
  aceptarTransferencia(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.entradasService.aceptarTransferencia(
      id,
      user.userId,
      user.role,
    );
  }

  @Put('transferencias/:id/rechazar')
  rechazarTransferencia(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.entradasService.rechazarTransferencia(
      id,
      user.userId,
      user.role,
    );
  }
}
