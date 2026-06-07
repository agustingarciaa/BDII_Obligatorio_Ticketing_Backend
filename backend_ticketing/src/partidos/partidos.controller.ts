import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { PartidosService } from './partidos.service';
import {
  CreatePartidoDto,
  UpdatePartidoDto,
  HabilitarSectorPartidoDto,
} from './partidos.dto';
import { Roles, CurrentUser } from '../auth/decorators';
import type { AuthUser } from '../auth/decorators';
import { Role } from '../auth/roles.enum';

@Controller('partidos')
export class PartidosController {
  constructor(private readonly partidosService: PartidosService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.partidosService.findAll(user.role);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.partidosService.findOne(id, user.role);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreatePartidoDto, @CurrentUser() user: AuthUser) {
    return this.partidosService.create(dto, user.role);
  }

  @Roles(Role.ADMIN)
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePartidoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.partidosService.update(id, dto, user.role);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.partidosService.remove(id, user.role);
  }

  @Roles(Role.ADMIN)
  @Post(':id/sectores')
  habilitarSector(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: HabilitarSectorPartidoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.partidosService.habilitarSector(id, dto, user.role);
  }
}
