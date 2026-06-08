import { IsInt, IsString } from 'class-validator';

export class ValidarEntradaDto {
  @IsInt()
  id_boleto!: number;

  @IsInt()
  id_dispositivo!: number;

  @IsString()
  qr_token!: string;
}
