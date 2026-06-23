import {
  IsInt,
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class CreatePartidoDto {
  @IsInt()
  id_estadio!: number;

  @IsString()
  equipo_pais_local!: string;

  @IsString()
  equipo_pais_visitante!: string;

  @IsDateString()
  fecha_hora!: string;
}

export class UpdatePartidoDto {
  @IsOptional()
  @IsInt()
  id_estadio?: number;

  @IsOptional()
  @IsString()
  equipo_pais_local?: string;

  @IsOptional()
  @IsString()
  equipo_pais_visitante?: string;

  @IsOptional()
  @IsDateString()
  fecha_hora?: string;
}

export class HabilitarSectorPartidoDto {
  @IsString()
  sector_nombre_sector!: string;

  @IsInt()
  sector_id_estadio!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  costo_entrada!: number;
}
