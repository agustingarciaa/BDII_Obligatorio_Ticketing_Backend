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
import { DispositivosService } from './dispositivos.service';
import { CreateDispositivoDto, UpdateDispositivoDto } from './dispositivos.dto';
import { Roles, CurrentUser } from '../auth/decorators';
import type { AuthUser } from '../auth/decorators';
import { Role } from '../auth/roles.enum';

@Controller('dispositivos')
@Roles(Role.ADMIN)
export class DispositivosController {
  constructor(private readonly dispositivosService: DispositivosService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.dispositivosService.findAll(user.role);
  }

  @Get('funcionarios')
  listarFuncionarios(@CurrentUser() user: AuthUser) {
    return this.dispositivosService.listarFuncionarios(user.role);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.dispositivosService.findOne(id, user.role);
  }

  @Post()
  create(@Body() dto: CreateDispositivoDto, @CurrentUser() user: AuthUser) {
    return this.dispositivosService.create(dto, user.role);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDispositivoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.dispositivosService.update(id, dto, user.role);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.dispositivosService.remove(id, user.role);
  }
}
