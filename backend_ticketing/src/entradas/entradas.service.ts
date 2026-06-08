import { Injectable } from '@nestjs/common';
import { Role } from '../auth/roles.enum';
import { ComprarEntradaDto, TransferirEntradaDto } from './entradas.dto';

@Injectable()
export class EntradasService {
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

  async misCompras(_usuarioId: number, _role: Role) {
    // TODO: SELECT v.*, COUNT(e.id_boleto) AS cantidad FROM VENTA v JOIN ENTRADA e ON e.venta_id_venta = v.id_venta
    //   WHERE v.id_usuario = ? GROUP BY v.id_venta ORDER BY v.fecha DESC
  }

  async misTransferencias(_usuarioId: number, _role: Role) {
    // TODO: SELECT * FROM TRANSFERENCIA WHERE origen_id_usuario = ? OR destino_id_usuario = ? ORDER BY fecha DESC
  }

  async aceptarTransferencia(
    _transferenciaId: number,
    _usuarioId: number,
    _role: Role,
  ) {
    // TODO: UPDATE ENTRADA SET propietario_id_usuario = destino_id_usuario WHERE id_boleto = entrada_id_boleto
    //   UPDATE TRANSFERENCIA SET estado = 'aceptada' WHERE id_transferencia = ?
  }

  async rechazarTransferencia(
    _transferenciaId: number,
    _usuarioId: number,
    _role: Role,
  ) {
    // TODO: UPDATE TRANSFERENCIA SET estado = 'rechazada' WHERE id_transferencia = ?
  }

  async misEntradas(_usuarioId: number, _role: Role) {
    // TODO: SELECT e.* FROM ENTRADA e WHERE e.propietario_id_usuario = ? AND e.estado = 'activo' AND e.activo = TRUE
  }

  async consultarValidacion(_entradaId: number, _role: Role) {
    // TODO: SELECT estado FROM ENTRADA WHERE id_boleto = ?
  }
}
