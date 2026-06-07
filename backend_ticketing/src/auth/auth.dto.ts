import { IsEmail, IsString, IsInt, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  doc_pais!: string;

  @IsString()
  doc_tipo!: string;

  @IsString()
  doc_numero!: string;

  @IsEmail()
  mail!: string;

  @IsString()
  @MinLength(8)
  contrasena!: string;

  @IsString()
  dir_pais!: string;

  @IsString()
  dir_localidad!: string;

  @IsString()
  dir_calle!: string;

  @IsInt()
  dir_numero!: number;

  @IsString()
  dir_codigo_postal!: string;
}

export class LoginDto {
  @IsEmail()
  mail!: string;

  @IsString()
  contrasena!: string;
}
