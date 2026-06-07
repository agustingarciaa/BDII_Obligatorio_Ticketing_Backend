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
import { EstadiosService } from './estadios.service';
import { CreateEstadioDto, UpdateEstadioDto } from './estadios.dto';
import { Roles, CurrentUser } from '../auth/decorators';
import type { AuthUser } from '../auth/decorators';
import { Role } from '../auth/roles.enum';

@Controller('estadios')
export class EstadiosController {
  constructor(private readonly estadiosService: EstadiosService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.estadiosService.findAll(user.role);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.estadiosService.findOne(id, user.role);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateEstadioDto, @CurrentUser() user: AuthUser) {
    return this.estadiosService.create(dto, user.role);
  }

  @Roles(Role.ADMIN)
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEstadioDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.estadiosService.update(id, dto, user.role);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.estadiosService.remove(id, user.role);
  }
}
