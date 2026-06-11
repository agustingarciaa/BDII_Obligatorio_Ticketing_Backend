import { IsInt, IsString, Max, Min } from 'class-validator';

export class ComprarEntradaDto {
  @IsString()
  sectorpartido_nombre_sector!: string;

  @IsInt()
  sectorpartido_id_estadio!: number;

  @IsInt()
  sectorpartido_id_evento!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  cantidad!: number;
}

export class TransferirEntradaDto {
  @IsInt()
  id_boleto!: number;

  @IsInt()
  destino_id_usuario!: number;
}
