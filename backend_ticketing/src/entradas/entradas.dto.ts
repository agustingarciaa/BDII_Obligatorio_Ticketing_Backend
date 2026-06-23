import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ItemCompraDto {
  @IsString()
  sectorpartido_nombre_sector!: string;

  @IsInt()
  sectorpartido_id_estadio!: number;

  @IsInt()
  sectorpartido_id_evento!: number;

  @IsInt()
  @Min(1)
  cantidad!: number;
}

export class ComprarEntradaDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemCompraDto)
  items!: ItemCompraDto[];
}

export class TransferirEntradaDto {
  @IsInt()
  id_boleto!: number;

  @IsInt()
  destino_id_usuario!: number;
}
