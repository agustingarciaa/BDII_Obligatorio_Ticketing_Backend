import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { EstadiosModule } from './estadios/estadios.module';
import { PartidosModule } from './partidos/partidos.module';
import { EquiposModule } from './equipos/equipos.module';
import { SectoresModule } from './sectores/sectores.module';
import { DispositivosModule } from './dispositivos/dispositivos.module';
import { EstadisticasModule } from './estadisticas/estadisticas.module';
import { EntradasModule } from './entradas/entradas.module';
import { ValidacionModule } from './validacion/validacion.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 60000, limit: 100 },
    ]),
    DatabaseModule,
    AuthModule,
    EstadiosModule,
    PartidosModule,
    EquiposModule,
    SectoresModule,
    DispositivosModule,
    EstadisticasModule,
    EntradasModule,
    ValidacionModule,
    UsuariosModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
