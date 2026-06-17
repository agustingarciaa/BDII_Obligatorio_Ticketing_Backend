import {
  IsString,
  IsInt,
  IsOptional,
  Matches,
  MinLength,
  IsArray,
} from 'class-validator';

//Para que el usuario modifique sus propios datos de perfil:
export class ModificarUsuarioDto {
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, {
    message: 'La contraseña debe contener: mayúsculas, minúsculas y números',
  })
  contrasena?: string;

  @IsOptional()
  @IsString()
  dir_pais?: string;

  @IsOptional()
  @IsString()
  dir_localidad?: string;

  @IsOptional()
  @IsString()
  dir_calle?: string;

  @IsOptional()
  @IsInt()
  dir_numero?: number;

  @IsOptional()
  @IsString()
  dir_codigo_postal?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  telefonos?: string[];
}
