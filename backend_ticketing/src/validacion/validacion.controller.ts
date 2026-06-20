import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { ValidacionService } from './validacion.service';
import { ValidarEntradaDto } from './validacion.dto';
import { Roles, CurrentUser } from '../auth/decorators';
import type { AuthUser } from '../auth/decorators';
import { Role } from '../auth/roles.enum';

@Controller('validacion')
export class ValidacionController {
  constructor(private readonly validacionService: ValidacionService) {}

  @Roles(Role.CLIENTE)
  @Get('qr/:id_boleto')
  generarQR(
    @Param('id_boleto', ParseIntPipe) idBoleto: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.validacionService.generarQR(idBoleto, user.userId, user.role);
  }

  @Roles(Role.FUNCIONARIO)
  @Post('escanear')
  escanear(@Body() dto: ValidarEntradaDto, @CurrentUser() user: AuthUser) {
    return this.validacionService.escanear(dto, user);
  }
}
