import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '../auth/roles.enum';
import { DatabaseService } from '../database/database.service';
import { ComprarEntradaDto, TransferirEntradaDto } from './entradas.dto';

type VentaRow = {
  id_venta: number;
  fecha: string;
  id_usuario: number;
  cantidad: number;
};

type TransferenciaRow = {
  id_transferencia: number;
  entrada_id_boleto: number;
  origen_id_usuario: number;
  destino_id_usuario: number;
  estado: string;
  fecha: string;
};

type TransferenciaConEntradaRow = {
  id_transferencia: number;
  entrada_id_boleto: number;
  origen_id_usuario: number;
  destino_id_usuario: number;
  estado: string;
  propietario_id_usuario: number;
  estado_entrada: string;
  activo: number | boolean;
};

type EntradaRow = {
  id_boleto: number;
  propietario_id_usuario: number;
  estado: string;
  activo: number | boolean;
};

type EstadoEntradaRow = {
  estado: string;
};

@Injectable()
export class EntradasService {
  constructor(private readonly databaseService: DatabaseService) {}

  async comprar(_usuarioId: number, _dto: ComprarEntradaDto, _role: Role) {
    // TODO: Verificar stock en SECTOR_PARTIDO, crear VENTA e ENTRADA/S (máx 5)
  }

  async transferir(
    _usuarioId: number,
    _dto: TransferirEntradaDto,
    _role: Role,
  ) {
    // TODO: INSERT INTO TRANSFERENCIA (entrada_id_boleto, origen_id_usuario, destino_id_usuario) con estado 'pendiente'
  }

  async misCompras(usuarioId: number, _role: Role) {
    const ventas = await this.databaseService.query<VentaRow>(
      `SELECT v.*, COUNT(e.id_boleto) AS cantidad
       FROM VENTA v
       JOIN ENTRADA e ON e.venta_id_venta = v.id_venta
       WHERE v.id_usuario = ?
       GROUP BY v.id_venta
       ORDER BY v.fecha DESC`,
      [usuarioId],
    );

    return ventas;
  }

  async misTransferencias(usuarioId: number, _role: Role) {
    const transferenciasEnviadas =
      await this.databaseService.query<TransferenciaRow>(
        `SELECT *
         FROM TRANSFERENCIA
         WHERE origen_id_usuario = ?
         ORDER BY fecha DESC`,
        [usuarioId],
      );

    const transferenciasRecibidas =
      await this.databaseService.query<TransferenciaRow>(
        `SELECT *
         FROM TRANSFERENCIA
         WHERE destino_id_usuario = ?
         ORDER BY fecha DESC`,
        [usuarioId],
      );

    return {
      enviadas: transferenciasEnviadas,
      recibidas: transferenciasRecibidas,
    };
  }

  async aceptarTransferencia(
    transferenciaId: number,
    usuarioId: number,
    _role: Role,
  ) {
    const transferencias =
      await this.databaseService.query<TransferenciaConEntradaRow>(
        `SELECT t.id_transferencia,
                t.entrada_id_boleto,
                t.origen_id_usuario,
                t.destino_id_usuario,
                t.estado,
                e.propietario_id_usuario,
                e.estado AS estado_entrada,
                e.activo
         FROM TRANSFERENCIA t
         JOIN ENTRADA e ON e.id_boleto = t.entrada_id_boleto
         WHERE t.id_transferencia = ?`,
        [transferenciaId],
      );

    const transferencia = transferencias[0];

    if (transferencia === undefined) {
      throw new NotFoundException('Transferencia no encontrada');
    }

    if (transferencia.estado !== 'pendiente') {
      throw new BadRequestException('La transferencia no está pendiente');
    }

    if (transferencia.destino_id_usuario !== usuarioId) {
      throw new ForbiddenException('No podés aceptar esta transferencia');
    }

    if (
      transferencia.propietario_id_usuario !==
        transferencia.origen_id_usuario ||
      transferencia.estado_entrada !== 'activo' ||
      (transferencia.activo !== true && transferencia.activo !== 1)
    ) {
      throw new BadRequestException('La entrada no está disponible');
    }

    await this.databaseService.query('START TRANSACTION');

    try {
      await this.databaseService.query(
        `UPDATE ENTRADA
         SET propietario_id_usuario = ?
         WHERE id_boleto = ?`,
        [usuarioId, transferencia.entrada_id_boleto],
      );

      await this.databaseService.query(
        `UPDATE TRANSFERENCIA
         SET estado = 'aceptada'
         WHERE id_transferencia = ?`,
        [transferenciaId],
      );

      await this.databaseService.query('COMMIT');

      return { message: 'Transferencia aceptada correctamente' };
    } catch (error) {
      await this.databaseService.query('ROLLBACK');
      throw error;
    }
  }

  async rechazarTransferencia(
    transferenciaId: number,
    usuarioId: number,
    _role: Role,
  ) {
    const transferencias = await this.databaseService.query<TransferenciaRow>(
      `SELECT *
       FROM TRANSFERENCIA
       WHERE id_transferencia = ?`,
      [transferenciaId],
    );

    const transferencia = transferencias[0];

    if (transferencia === undefined) {
      throw new NotFoundException('Transferencia no encontrada');
    }

    if (transferencia.estado !== 'pendiente') {
      throw new BadRequestException('La transferencia no está pendiente');
    }

    if (transferencia.destino_id_usuario !== usuarioId) {
      throw new ForbiddenException('No podés rechazar esta transferencia');
    }

    await this.databaseService.query(
      `UPDATE TRANSFERENCIA
       SET estado = 'rechazada'
       WHERE id_transferencia = ?`,
      [transferenciaId],
    );

    return { message: 'Transferencia rechazada correctamente' };
  }

  async misEntradas(usuarioId: number, _role: Role) {
    const entradas = await this.databaseService.query<EntradaRow>(
      `SELECT e.*
       FROM ENTRADA e
       WHERE e.propietario_id_usuario = ?
         AND e.estado = 'activo'
         AND e.activo = TRUE`,
      [usuarioId],
    );

    return entradas;
  }

  async consultarValidacion(
    entradaId: number,

    usuarioId: number,
    role: Role,
  ) {
    if (role === Role.FUNCIONARIO) {
      throw new ForbiddenException(
        'El funcionario no puede consultar validación.',
      );
    }

    let query = `
      SELECT estado
      FROM ENTRADA
      WHERE id_boleto = ?
    `;

    const params: number[] = [entradaId];

    if (role === Role.CLIENTE) {
      query += `
        AND propietario_id_usuario = ?
      `;
      params.push(usuarioId);
    }

    const entradas = await this.databaseService.query<EstadoEntradaRow>(
      query,
      params,
    );

    const entrada = entradas[0];

    if (entrada === undefined) {
      throw new NotFoundException('Entrada no encontrada');
    }

    return { estado: entrada.estado };
  }
}
