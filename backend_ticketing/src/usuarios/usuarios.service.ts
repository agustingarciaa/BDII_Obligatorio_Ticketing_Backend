import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { QueryParam } from '../database/database.service';
import { DatabaseService } from '../database/database.service';
import { Role } from '../auth/roles.enum';
import { ModificarUsuarioDto } from './usuarios.dto';

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
  telefonos: string | null;
}

type UsuarioBusquedaRow = {
  id_usuario: number;
  mail: string;
};

@Injectable()
export class UsuariosService {
  constructor(private readonly db: DatabaseService) {}

  async misDatos(userId: number, role: Role) {
    const [usuario] = await this.db.query<UsuarioData>(
      `SELECT u.mail,
              u.doc_pais,
              u.doc_tipo,
              u.doc_numero,
              u.dir_pais,
              u.dir_localidad,
              u.dir_calle,
              u.dir_numero,
              u.dir_codigo_postal,
              GROUP_CONCAT(t.telefono) AS telefonos
       FROM USUARIO u
       LEFT JOIN TELEFONO_USUARIO t
         ON u.id_usuario = t.id_usuario
        AND t.activo = TRUE
       WHERE u.id_usuario = ?
         AND u.activo = TRUE
       GROUP BY u.id_usuario`,
      [userId],
      role,
    );

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return {
      mail: usuario.mail,
      doc_pais: usuario.doc_pais,
      doc_tipo: usuario.doc_tipo,
      doc_numero: usuario.doc_numero,
      dir_pais: usuario.dir_pais,
      dir_localidad: usuario.dir_localidad,
      dir_calle: usuario.dir_calle,
      dir_numero: usuario.dir_numero,
      dir_codigo_postal: usuario.dir_codigo_postal,
      telefonos: usuario.telefonos ? usuario.telefonos.split(',') : [],
    };
  }

  async modificarDatos(userId: number, dto: ModificarUsuarioDto, role: Role) {
    const [usuario] = await this.db.query<{ id_usuario: number }>(
      `SELECT id_usuario
       FROM USUARIO
       WHERE id_usuario = ?
         AND activo = TRUE
       LIMIT 1`,
      [userId],
      role,
    );

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const updates: string[] = [];
    const params: QueryParam[] = [];

    if (dto.contrasena) {
      const hash = await bcrypt.hash(dto.contrasena, 10);
      updates.push('contrasena = ?');
      params.push(hash);
    }

    if (dto.dir_pais) {
      updates.push('dir_pais = ?');
      params.push(dto.dir_pais);
    }

    if (dto.dir_localidad) {
      updates.push('dir_localidad = ?');
      params.push(dto.dir_localidad);
    }

    if (dto.dir_calle) {
      updates.push('dir_calle = ?');
      params.push(dto.dir_calle);
    }

    if (dto.dir_numero !== undefined) {
      updates.push('dir_numero = ?');
      params.push(dto.dir_numero);
    }

    if (dto.dir_codigo_postal) {
      updates.push('dir_codigo_postal = ?');
      params.push(dto.dir_codigo_postal);
    }

    if (updates.length === 0 && !dto.telefonos) {
      throw new BadRequestException('No hay datos para actualizar');
    }

    await this.db.withTransaction(async (query) => {
      if (updates.length > 0) {
        await query(
          `UPDATE USUARIO
           SET ${updates.join(', ')}
           WHERE id_usuario = ?`,
          [...params, userId],
        );
      }

      if (Array.isArray(dto.telefonos)) {
        await query(
          `UPDATE TELEFONO_USUARIO
           SET activo = FALSE
           WHERE id_usuario = ?`,
          [userId],
        );

        const telefonos = [...new Set(dto.telefonos)];

        for (const telefono of telefonos) {
          await query(
            `INSERT INTO TELEFONO_USUARIO (id_usuario, telefono, activo)
             VALUES (?, ?, TRUE)
             ON DUPLICATE KEY UPDATE activo = TRUE`,
            [userId, telefono],
          );
        }
      }
    }, role);

    return { message: 'Datos actualizados correctamente' };
  }

  async buscarPorMail(mail: string, selfId: number, role: Role) {
    const normalizedMail = mail?.trim();

    if (!normalizedMail || normalizedMail.length < 3) {
      throw new BadRequestException(
        'Ingresá al menos 3 caracteres para buscar.',
      );
    }

    return this.db.query<UsuarioBusquedaRow>(
      `SELECT u.id_usuario,
              u.mail
       FROM USUARIO u
       JOIN USUARIO_GENERAL ug
         ON ug.id_usuario = u.id_usuario
       WHERE u.mail LIKE ?
         AND u.activo = TRUE
         AND ug.activo = TRUE
         AND u.id_usuario != ?
       LIMIT 10`,
      [`%${normalizedMail}%`, selfId],
      role,
    );
  }

  async eliminarUsuario(userId: number, role: Role) {
    const [usuario] = await this.db.query<{ id_usuario: number }>(
      `SELECT id_usuario
       FROM USUARIO
       WHERE id_usuario = ?
         AND activo = TRUE
       LIMIT 1`,
      [userId],
      role,
    );

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const [entradas] = await this.db.query<{ n: number }>(
      `SELECT COUNT(*) AS n
       FROM ENTRADA e
       JOIN PARTIDO p
         ON p.id_evento = e.sectorpartido_id_evento
       WHERE e.propietario_id_usuario = ?
         AND e.activo = TRUE
         AND e.estado = 'activo'
         AND p.fecha_hora > NOW()`,
      [userId],
      role,
    );

    if (Number(entradas.n) > 0) {
      throw new ConflictException(
        'No podés eliminar tu cuenta: tenés entradas activas para partidos futuros.',
      );
    }

    const [transferencias] = await this.db.query<{ n: number }>(
      `SELECT COUNT(*) AS n
       FROM TRANSFERENCIA
       WHERE (origen_id_usuario = ? OR destino_id_usuario = ?)
         AND estado = 'pendiente'
         AND activo = TRUE`,
      [userId, userId],
      role,
    );

    if (Number(transferencias.n) > 0) {
      throw new ConflictException(
        'No podés eliminar tu cuenta: tenés transferencias pendientes de resolver.',
      );
    }

    await this.db.withTransaction(async (query) => {
      await query(
        `UPDATE USUARIO
         SET activo = FALSE
         WHERE id_usuario = ?`,
        [userId],
      );

      await query(
        `UPDATE USUARIO_GENERAL
         SET activo = FALSE
         WHERE id_usuario = ?`,
        [userId],
      );
    }, role);

    return { message: 'Cuenta eliminada correctamente' };
  }
}
