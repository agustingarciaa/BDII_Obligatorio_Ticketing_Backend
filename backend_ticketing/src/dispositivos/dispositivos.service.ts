import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Role } from '../auth/roles.enum';
import { CreateDispositivoDto, UpdateDispositivoDto } from './dispositivos.dto';

type DispositivoRow = {
  id_dispositivo: number;
  fun_id_usuario: number;
  activo: number | boolean;
  numero_legajo: number;
  mail: string;
};

type FuncionarioRow = {
  id_usuario: number;
  numero_legajo: number;
  mail: string;
  tiene_dispositivo: number | boolean;
};

const SELECT_DISPOSITIVO = `
  SELECT d.id_dispositivo, d.fun_id_usuario, d.activo,
         fv.numero_legajo, u.mail
  FROM DISPOSITIVO d
  JOIN FUNCIONARIO_VALIDACION fv ON fv.id_usuario = d.fun_id_usuario
  JOIN USUARIO u ON u.id_usuario = d.fun_id_usuario
`;

@Injectable()
export class DispositivosService {
  constructor(private readonly databaseService: DatabaseService) {}

  private toDispositivo(row: DispositivoRow) {
    return {
      id_dispositivo: row.id_dispositivo,
      fun_id_usuario: row.fun_id_usuario,
      activo: Boolean(row.activo),
      funcionario: {
        numero_legajo: row.numero_legajo,
        mail: row.mail,
      },
    };
  }

  async findAll(role: Role) {
    const rows = await this.databaseService.query<DispositivoRow>(
      `${SELECT_DISPOSITIVO} WHERE d.activo = TRUE ORDER BY d.id_dispositivo`,
      [],
      role,
    );
    return rows.map((r) => this.toDispositivo(r));
  }

  async findOne(id: number, role: Role) {
    const [row] = await this.databaseService.query<DispositivoRow>(
      `${SELECT_DISPOSITIVO} WHERE d.id_dispositivo = ? AND d.activo = TRUE LIMIT 1`,
      [id],
      role,
    );

    if (!row) {
      throw new NotFoundException(
        `No existe un dispositivo activo con id ${id}.`,
      );
    }

    return this.toDispositivo(row);
  }

  async create(dto: CreateDispositivoDto, role: Role) {
    const [funcionario] = await this.databaseService.query<{
      id_usuario: number;
    }>(
      'SELECT id_usuario FROM FUNCIONARIO_VALIDACION WHERE id_usuario = ? AND activo = TRUE LIMIT 1',
      [dto.fun_id_usuario],
      role,
    );

    if (!funcionario) {
      throw new NotFoundException(
        `No existe un funcionario activo con id ${dto.fun_id_usuario}.`,
      );
    }

    const [existing] = await this.databaseService.query<{
      id_dispositivo: number;
      activo: number | boolean;
    }>(
      'SELECT id_dispositivo, activo FROM DISPOSITIVO WHERE fun_id_usuario = ? LIMIT 1',
      [dto.fun_id_usuario],
      role,
    );

    if (existing && Boolean(existing.activo)) {
      throw new ConflictException(
        `El funcionario ${dto.fun_id_usuario} ya tiene un dispositivo registrado (id: ${existing.id_dispositivo}).`,
      );
    }

    if (existing) {
      await this.databaseService.query(
        'UPDATE DISPOSITIVO SET activo = TRUE WHERE id_dispositivo = ?',
        [existing.id_dispositivo],
        role,
      );

      const [reactivated] = await this.databaseService.query<DispositivoRow>(
        `${SELECT_DISPOSITIVO} WHERE d.id_dispositivo = ? LIMIT 1`,
        [existing.id_dispositivo],
        role,
      );

      return this.toDispositivo(reactivated);
    }

    const result = await this.databaseService.query(
      'INSERT INTO DISPOSITIVO (fun_id_usuario) VALUES (?)',
      [dto.fun_id_usuario],
      role,
    );

    const insertId = (result as unknown as { insertId: number }).insertId;

    const [created] = await this.databaseService.query<DispositivoRow>(
      `${SELECT_DISPOSITIVO} WHERE d.id_dispositivo = ? LIMIT 1`,
      [insertId],
      role,
    );

    return this.toDispositivo(created);
  }

  // Lista de funcionarios activos para vincular dispositivos.
  async listarFuncionarios(role: Role) {
    const rows = await this.databaseService.query<FuncionarioRow>(
      `SELECT fv.id_usuario, fv.numero_legajo, u.mail,
              EXISTS(
                SELECT 1 FROM DISPOSITIVO d
                WHERE d.fun_id_usuario = fv.id_usuario AND d.activo = TRUE
              ) AS tiene_dispositivo
       FROM FUNCIONARIO_VALIDACION fv
       JOIN USUARIO u ON u.id_usuario = fv.id_usuario
       WHERE fv.activo = TRUE
       ORDER BY fv.numero_legajo`,
      [],
      role,
    );

    return rows.map((r) => ({
      id_usuario: r.id_usuario,
      numero_legajo: r.numero_legajo,
      mail: r.mail,
      tiene_dispositivo: Boolean(r.tiene_dispositivo),
    }));
  }

  async update(id: number, dto: UpdateDispositivoDto, role: Role) {
    const [dispositivo] = await this.databaseService.query<{
      id_dispositivo: number;
      fun_id_usuario: number;
    }>(
      'SELECT id_dispositivo, fun_id_usuario FROM DISPOSITIVO WHERE id_dispositivo = ? AND activo = TRUE LIMIT 1',
      [id],
      role,
    );

    if (!dispositivo) {
      throw new NotFoundException(
        `No existe un dispositivo activo con id ${id}.`,
      );
    }

    // Sin cambios: ya está vinculado a ese funcionario.
    if (dispositivo.fun_id_usuario === dto.fun_id_usuario) {
      return this.findOne(id, role);
    }

    const [funcionario] = await this.databaseService.query<{
      id_usuario: number;
    }>(
      'SELECT id_usuario FROM FUNCIONARIO_VALIDACION WHERE id_usuario = ? AND activo = TRUE LIMIT 1',
      [dto.fun_id_usuario],
      role,
    );

    if (!funcionario) {
      throw new NotFoundException(
        `No existe un funcionario activo con id ${dto.fun_id_usuario}.`,
      );
    }

    // verificar que funcionario destino no tenga otro dispositivo.
    const [otro] = await this.databaseService.query<{
      id_dispositivo: number;
    }>(
      'SELECT id_dispositivo FROM DISPOSITIVO WHERE fun_id_usuario = ? LIMIT 1',
      [dto.fun_id_usuario],
      role,
    );

    if (otro) {
      throw new ConflictException(
        `El funcionario ${dto.fun_id_usuario} ya tiene un dispositivo asociado (id: ${otro.id_dispositivo}).`,
      );
    }

    await this.databaseService.query(
      'UPDATE DISPOSITIVO SET fun_id_usuario = ? WHERE id_dispositivo = ?',
      [dto.fun_id_usuario, id],
      role,
    );

    return this.findOne(id, role);
  }

  async remove(id: number, role: Role) {
    const [existing] = await this.databaseService.query<{
      id_dispositivo: number;
    }>(
      'SELECT id_dispositivo FROM DISPOSITIVO WHERE id_dispositivo = ? AND activo = TRUE LIMIT 1',
      [id],
      role,
    );

    if (!existing) {
      throw new NotFoundException(
        `No existe un dispositivo activo con id ${id}.`,
      );
    }

    await this.databaseService.query(
      'UPDATE DISPOSITIVO SET activo = FALSE WHERE id_dispositivo = ?',
      [id],
      role,
    );

    return { id_dispositivo: id, activo: false };
  }
}
