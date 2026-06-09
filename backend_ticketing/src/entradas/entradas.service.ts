import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '../auth/roles.enum';
import { DatabaseService } from '../database/database.service';
import { ComprarEntradaDto, TransferirEntradaDto } from './entradas.dto';

type VentaRow = {
  id_venta: number;
  fecha: string;
  id_usuario: number;
};

type TransferenciaRow = {
  id_transferencia: number;
  entrada_id_boleto: number;
  origen_id_usuario: number;
  destino_id_usuario: number;
  estado: string;
  fecha: string;
};

type EntradaRow = {
  id_boleto: number;
  propietario_id_usuario: number;
  estado: string;
  activo: number | boolean;
};

@Injectable()
export class EntradasService {
  constructor(private readonly databaseService: DatabaseService) {}

  async comprar(
    _usuarioId: number,

    _dto: ComprarEntradaDto,
    _role: Role,
  ) {
    // TODO: Verificar stock en SECTOR_PARTIDO, crear VENTA e ENTRADA/S (máx 5)
  }

  async transferir(
    _usuarioId: number,
    _dto: TransferirEntradaDto,
    _role: Role,
  ) {
    // TODO: INSERT INTO TRANSFERENCIA (entrada_id_boleto, origen_id_usuario, destino_id_usuario)
    // con estado 'pendiente'
  }

  async misCompras(_usuarioId: number, _role: Role) {
    const ventas = await this.databaseService.query<VentaRow[]>(
      `
      SELECT v.*, COUNT(e.id_boleto) AS cantidad
      FROM VENTA v
      JOIN ENTRADA e ON e.venta_id_venta = v.id_venta
      WHERE v.id_usuario = ?
      GROUP BY v.id_venta
      ORDER BY v.fecha DESC
      `,
      [_usuarioId],
    );

    return ventas;
  }

  async misTransferencias(_usuarioId: number, _role: Role) {
    const transferencias = await this.databaseService.query<TransferenciaRow[]>(
      `
        SELECT *
        FROM TRANSFERENCIA
        WHERE origen_id_usuario = ? OR destino_id_usuario = ?
        ORDER BY fecha DESC
        `,
      [_usuarioId, _usuarioId],
    );

    return transferencias;
  }

  async aceptarTransferencia(
    _transferenciaId: number,
    _usuarioId: number,
    _role: Role,
  ) {
    // TODO: UPDATE ENTRADA SET propietario_id_usuario = destino_id_usuario
    // WHERE id_boleto = entrada_id_boleto
    // TODO: UPDATE TRANSFERENCIA
    // SET estado = 'aceptada'
    // WHERE id_transferencia = ?
  }

  async rechazarTransferencia(
    _transferenciaId: number,
    _usuarioId: number,
    _role: Role,
  ) {
    // TODO: UPDATE TRANSFERENCIA
    // SET estado = 'rechazada'
    // WHERE id_transferencia = ?
  }

  async misEntradas(_usuarioId: number, _role: Role) {
    const entradas = await this.databaseService.query<EntradaRow[]>(
      `
      SELECT e.*
      FROM ENTRADA e
      WHERE e.propietario_id_usuario = ?
        AND e.estado = 'activo'
        AND e.activo = TRUE
      `,
      [_usuarioId],
    );

    return entradas;
  }

  async consultarValidacion(
    entradaId: number,

    usuarioId: number,
    role: Role,
  ) {
    const entradas = await this.databaseService.query<EntradaRow>(
      `
      SELECT *
      FROM ENTRADA
      WHERE id_boleto = ?
      `,
      [entradaId],
    );

    const entrada = entradas[0];

    if (!entrada) {
      throw new NotFoundException('Entrada no encontrada');
    }

    if (role === Role.CLIENTE && entrada.propietario_id_usuario !== usuarioId) {
      throw new NotFoundException('Entrada no encontrada');
    }

    if (role === Role.FUNCIONARIO) {
      throw new NotFoundException('No autorizado');
    }

    return { estado: entrada.estado };
  }
}
