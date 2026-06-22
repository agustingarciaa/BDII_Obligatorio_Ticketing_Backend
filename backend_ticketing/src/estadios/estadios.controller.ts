import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/decorators';
import type { AuthUser } from '../auth/decorators';
import { Role } from '../auth/roles.enum';
import { CreateEstadioDto, UpdateEstadioDto } from './estadios.dto';
import { EstadiosService } from './estadios.service';

@Controller('estadios')
export class EstadiosController {
  constructor(private readonly estadiosService: EstadiosService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.estadiosService.findAll(user.userId, user.role);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.estadiosService.findOne(id, user.userId, user.role);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateEstadioDto, @CurrentUser() user: AuthUser) {
    return this.estadiosService.create(dto, user.userId, user.role);
  }

  @Roles(Role.ADMIN)
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEstadioDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.estadiosService.update(id, dto, user.userId, user.role);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.estadiosService.remove(id, user.userId, user.role);
  }
}
