import { IsInt, IsString, Max } from 'class-validator';

export class ComprarEntradaDto {
  @IsInt()
  sectorpartido_nombre_sector!: number;

  @IsString()
  sectorpartido_sector_nombre!: string;

  @IsInt()
  sectorpartido_id_estadio!: number;

  @IsInt()
  sectorpartido_id_evento!: number;

  @IsInt()
  @Max(5)
  cantidad!: number;
}

export class TransferirEntradaDto {
  @IsInt()
  id_boleto!: number;

  @IsInt()
  destino_id_usuario!: number;
}
