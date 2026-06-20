import { Module } from '@nestjs/common';
import { EstadiosController } from './estadios.controller';
import { EstadiosService } from './estadios.service';

@Module({
  controllers: [EstadiosController],
  providers: [EstadiosService],
})
export class EstadiosModule {}
