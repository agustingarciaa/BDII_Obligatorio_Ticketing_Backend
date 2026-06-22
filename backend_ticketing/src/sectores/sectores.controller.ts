import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { SectoresService } from './sectores.service';
import {
  CreateSectorDto,
  UpdateSectorDto,
  AsignarFuncionarioSectorDto,
} from './sectores.dto';
import { Roles, CurrentUser } from '../auth/decorators';
import type { AuthUser } from '../auth/decorators';
import { Role } from '../auth/roles.enum';

@Controller('sectores')
export class SectoresController {
  constructor(private readonly sectoresService: SectoresService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.sectoresService.findAll(user.role);
  }

  @Roles(Role.FUNCIONARIO)
  @Get('mis-sectores')
  misSectores(@CurrentUser() user: AuthUser) {
    return this.sectoresService.misSectores(user.userId, user.role);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sectoresService.findOne(id, user.role);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(
    @Body() dto: CreateSectorDto,

    @CurrentUser() user: AuthUser,
  ) {
    return this.sectoresService.create(dto, user.userId, user.role);
  }

  @Roles(Role.ADMIN)
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSectorDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sectoresService.update(id, dto, user.userId, user.role);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Query('nombre_sector') nombreSector: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sectoresService.remove(
      id,
      nombreSector,
      user.userId,
      user.role,
    );
  }

  @Roles(Role.ADMIN)
  @Get('asignaciones')
  asignaciones(@CurrentUser() user: AuthUser) {
    return this.sectoresService.asignaciones(user.role);
  }

  @Roles(Role.ADMIN)
  @Post('asignar-funcionario')
  asignarFuncionario(
    @Body() dto: AsignarFuncionarioSectorDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sectoresService.asignarFuncionario(dto, user.userId, user.role);
  }

  @Roles(Role.ADMIN)
  @Delete('desasignar-funcionario')
  desasignarFuncionario(
    @Body() dto: AsignarFuncionarioSectorDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sectoresService.desasignarFuncionario(dto, user.userId, user.role);
  }
}
