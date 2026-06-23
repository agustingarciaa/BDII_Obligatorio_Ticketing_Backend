import { IsString } from 'class-validator';

export class ValidarEntradaDto {
  // El funcionario solo envía el token leído del QR.
  // El dispositivo se deduce del funcionario y el boleto, del token.
  @IsString()
  qr_token!: string;
}
