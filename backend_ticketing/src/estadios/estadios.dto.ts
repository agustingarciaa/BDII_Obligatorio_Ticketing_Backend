import { IsString, IsInt, Min, IsOptional } from 'class-validator';

export class CreateEstadioDto {
  @IsString()
  nombre!: string;

  @IsString()
  pais!: string;

  @IsString()
  ciudad!: string;
}

export class UpdateEstadioDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  pais?: string;

  @IsOptional()
  @IsString()
  ciudad?: string;
}
