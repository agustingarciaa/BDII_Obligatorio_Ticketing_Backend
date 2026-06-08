import { IsString, IsInt, IsOptional, Min } from 'class-validator';

export class CreateSectorDto {
  @IsString()
  nombre_sector!: string;

  @IsInt()
  id_estadio!: number;

  @IsInt()
  @Min(1)
  capacidad_max!: number;
}

export class UpdateSectorDto {
  @IsOptional()
  @IsString()
  nombre_sector?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacidad_max?: number;
}

export class AsignarFuncionarioSectorDto {
  @IsInt()
  funcionario_id_usuario!: number;

  @IsString()
  sectorpartido_nombre_sector!: string;

  @IsInt()
  sectorpartido_id_estadio!: number;

  @IsInt()
  sectorpartido_id_evento!: number;
}
