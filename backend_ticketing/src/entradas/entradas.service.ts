import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '../auth/roles.enum';
import { DatabaseService } from '../database/database.service';
import {
  ComprarEntradaDto,
  ItemCompraDto,
  TransferirEntradaDto,
} from './entradas.dto';

const MAX_ENTRADAS_POR_VENTA = 5;
const TASA_COMISION = 0.05;

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

type CompraAdminRow = {
  id_venta: number;
  fecha: string;
  estado: string;
  monto_total: string;
  tasa_comision: string;
  id_usuario: number;
  mail: string;
  cantidad_entradas: number;
};

type TransferenciaAdminRow = {
  id_transferencia: number;
  fecha: string;
  estado: string;
  entrada_id_boleto: number;
  origen_id_usuario: number;
  origen_mail: string;
  destino_id_usuario: number;
  destino_mail: string;
};

@Injectable()
export class EntradasService {
  constructor(private readonly databaseService: DatabaseService) {}

  async comprar(usuarioId: number, dto: ComprarEntradaDto, role: Role) {
    const items = this.mergeItems(dto.items);

    const totalEntradas = items.reduce((acc, item) => acc + item.cantidad, 0);
    if (totalEntradas > MAX_ENTRADAS_POR_VENTA) {
      throw new BadRequestException(
        `No se pueden comprar más de ${MAX_ENTRADAS_POR_VENTA} entradas en la misma transacción.`,
      );
    }

    const ahora = new Date();
    const detalle: (ItemCompraDto & {
      costo_entrada: number;
      capacidad_max: number;
    })[] = [];

    for (const item of items) {
      const [info] = await this.databaseService.query<{
        costo_entrada: string;
        capacidad_max: number;
        fecha_hora: string | Date;
      }>(
        `SELECT sp.costo_entrada, s.capacidad_max, p.fecha_hora
         FROM SECTOR_PARTIDO sp
         JOIN SECTOR s
           ON s.nombre_sector = sp.sector_nombre_sector
          AND s.id_estadio    = sp.sector_id_estadio
         JOIN PARTIDO p
           ON p.id_evento = sp.partido_id_evento
          AND p.activo   = TRUE
         WHERE sp.sector_nombre_sector = ?
           AND sp.sector_id_estadio    = ?
           AND sp.partido_id_evento    = ?
           AND sp.activo = TRUE
         LIMIT 1`,
        [
          item.sectorpartido_nombre_sector,
          item.sectorpartido_id_estadio,
          item.sectorpartido_id_evento,
        ],
        role,
      );

      if (!info) {
        throw new NotFoundException(
          `El sector '${item.sectorpartido_nombre_sector}' no está habilitado para el partido ${item.sectorpartido_id_evento}.`,
        );
      }

      if (new Date(info.fecha_hora) <= ahora) {
        throw new ConflictException(
          `El partido ${item.sectorpartido_id_evento} ya fue jugado.`,
        );
      }

      detalle.push({
        ...item,
        costo_entrada: Number(info.costo_entrada),
        capacidad_max: info.capacidad_max,
      });
    }

    // La transacción corre por el pool 'sistema' porque el SELECT ... FOR UPDATE requiere privilegios de bloqueo que el pool del cliente no tiene.
    return this.databaseService.withTransaction(async (query) => {
      for (const item of detalle) {
        await query(
          `SELECT costo_entrada FROM SECTOR_PARTIDO
           WHERE sector_nombre_sector = ? AND sector_id_estadio = ? AND partido_id_evento = ?
           FOR UPDATE`,
          [
            item.sectorpartido_nombre_sector,
            item.sectorpartido_id_estadio,
            item.sectorpartido_id_evento,
          ],
        );

        const [vendidas] = await query<{ n: number }>(
          `SELECT COUNT(*) AS n FROM ENTRADA
           WHERE sectorpartido_nombre_sector = ?
             AND sectorpartido_id_estadio    = ?
             AND sectorpartido_id_evento     = ?
             AND activo = TRUE`,
          [
            item.sectorpartido_nombre_sector,
            item.sectorpartido_id_estadio,
            item.sectorpartido_id_evento,
          ],
        );

        const disponibles = item.capacidad_max - Number(vendidas.n);
        if (item.cantidad > disponibles) {
          throw new ConflictException(
            `No hay lugares suficientes en el sector '${item.sectorpartido_nombre_sector}': quedan ${Math.max(disponibles, 0)} y se pidieron ${item.cantidad}.`,
          );
        }
      }

      const subtotal = detalle.reduce(
        (acc, item) => acc + item.costo_entrada * item.cantidad,
        0,
      );
      const montoTotal = Math.round(subtotal * (1 + TASA_COMISION) * 100) / 100;

      const ventaResult = await query(
        `INSERT INTO VENTA (estado, monto_total, tasa_comision, id_usuario)
         VALUES ('realizada', ?, ?, ?)`,
        [montoTotal, TASA_COMISION, usuarioId],
      );
      const idVenta = (ventaResult as unknown as { insertId: number }).insertId;

      const entradas: {
        id_boleto: number;
        sector: string;
        id_estadio: number;
        id_evento: number;
        costo_entrada: number;
      }[] = [];

      for (const item of detalle) {
        for (let i = 0; i < item.cantidad; i++) {
          const entradaResult = await query(
            `INSERT INTO ENTRADA
               (venta_id_venta, sectorpartido_nombre_sector,
                sectorpartido_id_estadio, sectorpartido_id_evento,
                propietario_id_usuario)
             VALUES (?, ?, ?, ?, ?)`,
            [
              idVenta,
              item.sectorpartido_nombre_sector,
              item.sectorpartido_id_estadio,
              item.sectorpartido_id_evento,
              usuarioId,
            ],
          );

          entradas.push({
            id_boleto: (entradaResult as unknown as { insertId: number })
              .insertId,
            sector: item.sectorpartido_nombre_sector,
            id_estadio: item.sectorpartido_id_estadio,
            id_evento: item.sectorpartido_id_evento,
            costo_entrada: item.costo_entrada,
          });
        }
      }

      return {
        id_venta: idVenta,
        estado: 'realizada',
        monto_total: montoTotal,
        tasa_comision: TASA_COMISION,
        total_entradas: totalEntradas,
        entradas,
      };
    });
  }

  private mergeItems(items: ItemCompraDto[]): ItemCompraDto[] {
    const merged = new Map<string, ItemCompraDto>();

    for (const item of items) {
      const key = `${item.sectorpartido_id_evento}|${item.sectorpartido_id_estadio}|${item.sectorpartido_nombre_sector}`;
      const existing = merged.get(key);
      if (existing) {
        existing.cantidad += item.cantidad;
      } else {
        merged.set(key, { ...item });
      }
    }

    // si dos compras concurrentes comparten sectores, bloquean las filas en el mismo orden y no se deadlockean.
    return [...merged.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, item]) => item);
  }

  async transferir(usuarioId: number, dto: TransferirEntradaDto, role: Role) {
    if (dto.destino_id_usuario === usuarioId) {
      throw new BadRequestException(
        'No podés transferirte una entrada a vos mismo.',
      );
    }

    // Chequear que la entrada existe, está activa y no fue utilizada
    const [entrada] = await this.databaseService.query<{
      id_boleto: number;
      propietario_id_usuario: number;
      estado: string;
      fecha_hora: string | Date;
    }>(
      `SELECT e.id_boleto, e.propietario_id_usuario, e.estado, p.fecha_hora
       FROM ENTRADA e
       JOIN PARTIDO p ON p.id_evento = e.sectorpartido_id_evento
       WHERE e.id_boleto = ? AND e.activo = TRUE
       LIMIT 1`,
      [dto.id_boleto],
      role,
    );

    if (!entrada) {
      throw new NotFoundException(
        `No existe una entrada activa con id ${dto.id_boleto}.`,
      );
    }

    // chequear que aa entrada pertenece a quien la transfiere
    if (entrada.propietario_id_usuario !== usuarioId) {
      throw new ForbiddenException('La entrada no te pertenece.');
    }

    if (entrada.estado !== 'activo') {
      throw new ConflictException(
        `La entrada ya fue ${entrada.estado} y no se puede transferir.`,
      );
    }

    if (new Date(entrada.fecha_hora) <= new Date()) {
      throw new ConflictException(
        'No se puede transferir una entrada de un partido ya jugado.',
      );
    }

    // El destinatario debe ser usuario general activo
    const [destinatario] = await this.databaseService.query<{
      id_usuario: number;
    }>(
      'SELECT id_usuario FROM USUARIO_GENERAL WHERE id_usuario = ? AND activo = TRUE LIMIT 1',
      [dto.destino_id_usuario],
      role,
    );
    if (!destinatario) {
      throw new NotFoundException(
        `No existe un usuario general activo con id ${dto.destino_id_usuario}.`,
      );
    }

    // No puede haber otra transferencia pendiente de la misma entrada
    const [pendiente] = await this.databaseService.query<{
      id_transferencia: number;
    }>(
      `SELECT id_transferencia FROM TRANSFERENCIA
       WHERE entrada_id_boleto = ? AND estado = 'pendiente' AND activo = TRUE
       LIMIT 1`,
      [dto.id_boleto],
      role,
    );
    if (pendiente) {
      throw new ConflictException(
        'La entrada ya tiene una transferencia en curso.',
      );
    }

    // Máximo 3 transferencias aceptadas por entrada
    const [aceptadas] = await this.databaseService.query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM TRANSFERENCIA
       WHERE entrada_id_boleto = ? AND estado = 'aceptada' AND activo = TRUE`,
      [dto.id_boleto],
      role,
    );
    if (Number(aceptadas.n) >= 3) {
      throw new ConflictException(
        'La entrada ya alcanzó el máximo de 3 transferencias.',
      );
    }

    const result = await this.databaseService.query(
      `INSERT INTO TRANSFERENCIA (entrada_id_boleto, origen_id_usuario, destino_id_usuario)
       VALUES (?, ?, ?)`,
      [dto.id_boleto, usuarioId, dto.destino_id_usuario],
      role,
    );

    return {
      id_transferencia: (result as unknown as { insertId: number }).insertId,
      entrada_id_boleto: dto.id_boleto,
      origen_id_usuario: usuarioId,
      destino_id_usuario: dto.destino_id_usuario,
      estado: 'pendiente',
    };
  }

  async listarTodasLasCompras(role: Role) {
    const compras = await this.databaseService.query<CompraAdminRow>(
      `SELECT v.id_venta,
              v.fecha,
              v.estado,
              v.monto_total,
              v.tasa_comision,
              v.id_usuario,
              u.mail,
              COUNT(e.id_boleto) AS cantidad_entradas
       FROM VENTA v
       JOIN USUARIO u
         ON u.id_usuario = v.id_usuario
       LEFT JOIN ENTRADA e
         ON e.venta_id_venta = v.id_venta
        AND e.activo = TRUE
       WHERE v.activo = TRUE
       GROUP BY v.id_venta,
                v.fecha,
                v.estado,
                v.monto_total,
                v.tasa_comision,
                v.id_usuario,
                u.mail
       ORDER BY v.fecha DESC`,
      [],
      role,
    );

    return compras;
  }

  async listarTodasLasTransferencias(role: Role) {
    const transferencias =
      await this.databaseService.query<TransferenciaAdminRow>(
        `SELECT t.id_transferencia,
                t.fecha,
                t.estado,
                t.entrada_id_boleto,
                t.origen_id_usuario,
                uo.mail AS origen_mail,
                t.destino_id_usuario,
                ud.mail AS destino_mail
         FROM TRANSFERENCIA t
         JOIN USUARIO uo
           ON uo.id_usuario = t.origen_id_usuario
         JOIN USUARIO ud
           ON ud.id_usuario = t.destino_id_usuario
         WHERE t.activo = TRUE
         ORDER BY t.fecha DESC`,
        [],
        role,
      );

    return transferencias;
  }

  async misCompras(usuarioId: number, role: Role) {
    const ventas = await this.databaseService.query<VentaRow>(
      `SELECT v.*, COUNT(e.id_boleto) AS cantidad
       FROM VENTA v
       JOIN ENTRADA e ON e.venta_id_venta = v.id_venta
       WHERE v.id_usuario = ? AND v.activo = TRUE
       GROUP BY v.id_venta
       ORDER BY v.fecha DESC`,
      [usuarioId],
      role,
    );

    return ventas;
  }

  async misTransferencias(usuarioId: number, role: Role) {
    const transferenciasEnviadas =
      await this.databaseService.query<TransferenciaRow>(
        `SELECT *
         FROM TRANSFERENCIA
         WHERE origen_id_usuario = ? AND activo = TRUE
         ORDER BY fecha DESC`,
        [usuarioId],
        role,
      );

    const transferenciasRecibidas =
      await this.databaseService.query<TransferenciaRow>(
        `SELECT *
         FROM TRANSFERENCIA
         WHERE destino_id_usuario = ? AND activo = TRUE
         ORDER BY fecha DESC`,
        [usuarioId],
        role,
      );

    return {
      enviadas: transferenciasEnviadas,
      recibidas: transferenciasRecibidas,
    };
  }

  async aceptarTransferencia(
    transferenciaId: number,
    usuarioId: number,
    role: Role,
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
         WHERE t.id_transferencia = ? AND t.activo = TRUE`,
        [transferenciaId],
        role,
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

    await this.databaseService.withTransaction(async (query) => {
      await query(
        `UPDATE ENTRADA
         SET propietario_id_usuario = ?,
             qr_token_actual = NULL,
             qr_token_expira_en = NULL
         WHERE id_boleto = ?`,
        [usuarioId, transferencia.entrada_id_boleto],
      );

      await query(
        `UPDATE TRANSFERENCIA
         SET estado = 'aceptada'
         WHERE id_transferencia = ?`,
        [transferenciaId],
      );
    }, role);

    return { message: 'Transferencia aceptada correctamente' };
  }

  async rechazarTransferencia(
    transferenciaId: number,
    usuarioId: number,
    role: Role,
  ) {
    const transferencias = await this.databaseService.query<TransferenciaRow>(
      `SELECT *
       FROM TRANSFERENCIA
       WHERE id_transferencia = ? AND activo = TRUE`,
      [transferenciaId],
      role,
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
      role,
    );

    return { message: 'Transferencia rechazada correctamente' };
  }

  async misEntradas(usuarioId: number, role: Role) {
    const entradas = await this.databaseService.query<EntradaRow>(
      `SELECT e.*
       FROM ENTRADA e
       WHERE e.propietario_id_usuario = ?
         AND e.estado = 'activo'
         AND e.activo = TRUE`,
      [usuarioId],
      role,
    );

    return entradas;
  }

  async consultarValidacion(entradaId: number, usuarioId: number, role: Role) {
    let query = `
      SELECT estado
      FROM ENTRADA
      WHERE id_boleto = ? AND activo = TRUE
    `;

    const params: number[] = [entradaId];

    // El cliente solo consulta sus propias entradas; el funcionario, cualquiera
    if (role === Role.CLIENTE) {
      query += ' AND propietario_id_usuario = ?';
      params.push(usuarioId);
    }

    const entradas = await this.databaseService.query<EstadoEntradaRow>(
      query,
      params,
      role,
    );

    const entrada = entradas[0];

    if (entrada === undefined) {
      throw new NotFoundException('Entrada no encontrada');
    }

    return { estado: entrada.estado, validada: entrada.estado === 'utilizada' };
  }
}
