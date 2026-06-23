import { IsInt, IsPositive } from 'class-validator';

export class CreateDispositivoDto {
  @IsInt()
  @IsPositive()
  fun_id_usuario!: number;
}

export class UpdateDispositivoDto {
  @IsInt()
  @IsPositive()
  fun_id_usuario!: number;
}
