import { Module } from '@nestjs/common';
import { PartidosController } from './partidos.controller';
import { PartidosService } from './partidos.service';

@Module({
  controllers: [PartidosController],
  providers: [PartidosService],
})
export class PartidosModule {}
