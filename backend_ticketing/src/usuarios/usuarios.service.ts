import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Role } from '../auth/roles.enum';
import { ModificarUsuarioDto } from './usuarios.dto';
import * as bcrypt from 'bcrypt';

interface UsuarioData {
  mail: string;
  doc_pais: string;
  doc_tipo: string;
  doc_numero: string;
  dir_pais: string;
  dir_localidad: string;
  dir_calle: string;
  dir_numero: number;
  dir_codigo_postal: string;
  telefonos: string;
}

@Injectable()
export class UsuariosService {
  constructor(private db: DatabaseService) {}

  async misDatos(userId: number, role: Role) {
    const usuario = await this.db.query<UsuarioData>(
      `SELECT 
        u.mail, u.doc_pais, u.doc_tipo, u.doc_numero, 
        u.dir_pais, u.dir_localidad, u.dir_calle, u.dir_numero, u.dir_codigo_postal, 
        GROUP_CONCAT(t.telefono) as telefonos
      FROM USUARIO u
      LEFT JOIN TELEFONO_USUARIO t ON u.id_usuario = t.id_usuario AND t.activo = TRUE
      WHERE u.id_usuario = ? AND u.activo = TRUE
      GROUP BY u.id_usuario`,
      [userId],
      role,
    );

    if (!usuario || usuario.length === 0) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const usuarioData = usuario[0];
    return {
      mail: usuarioData.mail,
      doc_pais: usuarioData.doc_pais,
      doc_tipo: usuarioData.doc_tipo,
      doc_numero: usuarioData.doc_numero,
      dir_pais: usuarioData.dir_pais,
      dir_localidad: usuarioData.dir_localidad,
      dir_calle: usuarioData.dir_calle,
      dir_numero: usuarioData.dir_numero,
      dir_codigo_postal: usuarioData.dir_codigo_postal,
      telefonos: usuarioData.telefonos ? usuarioData.telefonos.split(',') : [],
    };
  }

  async modificarDatos(userId: number, dto: ModificarUsuarioDto, role: Role) {
    const [usuario] = await this.db.query<{ id_usuario: number }>(
      'SELECT id_usuario FROM USUARIO WHERE id_usuario = ? AND activo = TRUE',
      [userId],
      role,
    );

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (dto.contrasena) {
      const hash = await bcrypt.hash(dto.contrasena, 10);
      updates.push('contrasena = ?');
      params.push(hash);
    }

    if (updates.length === 0) {
      throw new BadRequestException('No hay datos para actualizar');
    }

    params.push(userId);

    await this.db.query(
      `UPDATE USUARIO SET ${updates.join(', ')} WHERE id_usuario = ?`,
      params,
      role,
    );

    return { message: 'Datos actualizados correctamente' };
  }

  async eliminarUsuario(userId: number, role: Role) {
    const [usuario] = await this.db.query<{ id_usuario: number }>(
      'SELECT id_usuario FROM USUARIO WHERE id_usuario = ? AND activo = TRUE',
      [userId],
      role,
    );

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Marcar como inactivo en lugar de eliminar
    await this.db.query(
      'UPDATE USUARIO SET activo = FALSE WHERE id_usuario = ?',
      [userId],
      role,
    );

    return { message: 'Cuenta eliminada correctamente' };
  }
}
