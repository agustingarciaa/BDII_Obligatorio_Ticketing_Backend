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
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    {
      message:
        'La contraseña debe contener: mayúsculas, minúsculas, números y caracteres especiales (@$!%*?&)',
    },
  )
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

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  telefonos?: string[];
}
