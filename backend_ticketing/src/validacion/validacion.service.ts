import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Role } from '../auth/roles.enum';
import type { AuthUser } from '../auth/decorators';
import { DatabaseService } from '../database/database.service';
import { ValidarEntradaDto } from './validacion.dto';

const QR_VIGENCIA_SEGUNDOS = 30;
// Ventana de validación en puerta: ±3 h respecto del horario del partido
const VENTANA_VALIDACION_HORAS = 3;

@Injectable()
export class ValidacionService {
  constructor(private readonly db: DatabaseService) {}

  async generarQR(idBoleto: number, usuarioId: number, role: Role) {
    const [entrada] = await this.db.query<{
      propietario_id_usuario: number;
      estado: string;
      fecha_hora: string | Date;
    }>(
      `SELECT e.propietario_id_usuario, e.estado, p.fecha_hora
       FROM ENTRADA e
       JOIN PARTIDO p ON p.id_evento = e.sectorpartido_id_evento
       WHERE e.id_boleto = ? AND e.activo = TRUE
       LIMIT 1`,
      [idBoleto],
      role,
    );

    if (!entrada) {
      throw new NotFoundException(
        `No existe una entrada activa con id ${idBoleto}.`,
      );
    }

    if (entrada.propietario_id_usuario !== usuarioId) {
      throw new ForbiddenException('La entrada no te pertenece.');
    }

    if (entrada.estado !== 'activo') {
      throw new ConflictException(
        `La entrada ya fue ${entrada.estado} y no puede generar QR.`,
      );
    }

    if (new Date(entrada.fecha_hora) <= new Date()) {
      throw new ConflictException('El partido ya fue jugado.');
    }

    const token = randomBytes(32).toString('hex');

    // La expiración se calcula con el reloj de la DB (NOW()) 
    await this.db.query(
      `UPDATE ENTRADA
       SET qr_token_actual = ?,
           qr_token_expira_en = DATE_ADD(NOW(), INTERVAL ? SECOND)
       WHERE id_boleto = ?`,
      [token, QR_VIGENCIA_SEGUNDOS, idBoleto],
      role,
    );

    return {
      id_boleto: idBoleto,
      qr_token: token,
      vigencia_segundos: QR_VIGENCIA_SEGUNDOS,
    };
  }

  async escanear(dto: ValidarEntradaDto, user: AuthUser) {
    const [dispositivo] = await this.db.query<{ id_dispositivo: number }>(
      'SELECT id_dispositivo FROM DISPOSITIVO WHERE fun_id_usuario = ? AND activo = TRUE LIMIT 1',
      [user.userId],
      user.role,
    );
    if (!dispositivo) {
      throw new ConflictException('No tenés un dispositivo autorizado.');
    }

    const [entrada] = await this.db.query<{
      id_boleto: number;
      estado: string;
      vencido: number;
      en_ventana: number;
      sectorpartido_nombre_sector: string;
      sectorpartido_id_estadio: number;
      sectorpartido_id_evento: number;
    }>(
      `SELECT e.id_boleto, e.estado,
              (e.qr_token_expira_en < NOW()) AS vencido,
              (NOW() BETWEEN DATE_SUB(p.fecha_hora, INTERVAL ? HOUR)
                         AND DATE_ADD(p.fecha_hora, INTERVAL ? HOUR)) AS en_ventana,
              e.sectorpartido_nombre_sector,
              e.sectorpartido_id_estadio,
              e.sectorpartido_id_evento
       FROM ENTRADA e
       JOIN PARTIDO p ON p.id_evento = e.sectorpartido_id_evento
       WHERE e.qr_token_actual = ? AND e.activo = TRUE
       LIMIT 1`,
      [VENTANA_VALIDACION_HORAS, VENTANA_VALIDACION_HORAS, dto.qr_token],
      user.role,
    );

    if (!entrada) {
      throw new NotFoundException('QR inválido.');
    }

    if (Number(entrada.vencido) === 1) {
      throw new ConflictException(
        'QR vencido. Pedile al cliente que genere uno nuevo.',
      );
    }

    if (entrada.estado === 'utilizada') {
      throw new ConflictException('La entrada ya fue utilizada.');
    }

    if (Number(entrada.en_ventana) !== 1) {
      throw new ConflictException(
        'Fuera del horario de validación del partido.',
      );
    }

    const [asignacion] = await this.db.query<{ ok: number }>(
      `SELECT 1 AS ok
       FROM FUNCIONARIO_SECTOR_PARTIDO
       WHERE funcionario_id_usuario = ?
         AND sectorpartido_nombre_sector = ?
         AND sectorpartido_id_estadio = ?
         AND sectorpartido_id_evento = ?
         AND activo = TRUE
       LIMIT 1`,
      [
        user.userId,
        entrada.sectorpartido_nombre_sector,
        entrada.sectorpartido_id_estadio,
        entrada.sectorpartido_id_evento,
      ],
      user.role,
    );
    if (!asignacion) {
      throw new ForbiddenException('No estás asignado a este sector.');
    }

    try {
      await this.db.withTransaction(async (query) => {
        await query(
          `INSERT INTO VALIDACION (qr_usado, id_dispositivo, funcionario_id_usuario, id_boleto)
           VALUES (?, ?, ?, ?)`,
          [
            dto.qr_token,
            dispositivo.id_dispositivo,
            user.userId,
            entrada.id_boleto,
          ],
        );

        await query(
          `UPDATE ENTRADA
           SET estado = 'utilizada', qr_token_actual = NULL, qr_token_expira_en = NULL
           WHERE id_boleto = ?`,
          [entrada.id_boleto],
        );
      }, user.role);
    } catch (error) {
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
        throw new ConflictException('La entrada ya fue validada.');
      }
      throw error;
    }

    return {
      id_boleto: entrada.id_boleto,
      sector: entrada.sectorpartido_nombre_sector,
      id_estadio: entrada.sectorpartido_id_estadio,
      id_evento: entrada.sectorpartido_id_evento,
      validado: true,
    };
  }
}
