import { Module } from '@nestjs/common';
import { ValidacionController } from './validacion.controller';
import { ValidacionService } from './validacion.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ValidacionController],
  providers: [ValidacionService],
})
export class ValidacionModule {}
