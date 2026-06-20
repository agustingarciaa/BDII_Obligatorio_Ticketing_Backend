import { IsString } from 'class-validator';

export class CreateEquipoDto {
  @IsString()
  pais!: string;
}

export class UpdateEquipoDto {
  @IsString()
  pais!: string;
}
