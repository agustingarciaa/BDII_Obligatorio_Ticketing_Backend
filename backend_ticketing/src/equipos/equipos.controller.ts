import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { EquiposService } from './equipos.service';
import { CreateEquipoDto, UpdateEquipoDto } from './equipos.dto';
import { Roles, CurrentUser } from '../auth/decorators';
import type { AuthUser } from '../auth/decorators';
import { Role } from '../auth/roles.enum';

@Controller('equipos')
export class EquiposController {
  constructor(private readonly equiposService: EquiposService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.equiposService.findAll(user.role);
  }

  @Get(':pais')
  findOne(@Param('pais') pais: string, @CurrentUser() user: AuthUser) {
    return this.equiposService.findOne(pais, user.role);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateEquipoDto, @CurrentUser() user: AuthUser) {
    return this.equiposService.create(dto, user.role);
  }

  @Roles(Role.ADMIN)
  @Put(':pais')
  update(
    @Param('pais') pais: string,
    @Body() dto: UpdateEquipoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.equiposService.update(pais, dto, user.role);
  }

  @Roles(Role.ADMIN)
  @Delete(':pais')
  remove(@Param('pais') pais: string, @CurrentUser() user: AuthUser) {
    return this.equiposService.remove(pais, user.role);
  }
}
