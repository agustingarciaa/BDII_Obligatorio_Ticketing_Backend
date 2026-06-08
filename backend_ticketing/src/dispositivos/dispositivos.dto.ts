import { IsInt } from 'class-validator';

export class CreateDispositivoDto {
  @IsInt()
  fun_id_usuario!: number;
}
