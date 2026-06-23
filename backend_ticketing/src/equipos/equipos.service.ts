import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '../auth/roles.enum';
import { DatabaseService } from '../database/database.service';
import { CreateEquipoDto, UpdateEquipoDto } from './equipos.dto';

type EquipoRow = {
  pais: string;
  activo: number | boolean;
};

@Injectable()
export class EquiposService {
  constructor(private readonly databaseService: DatabaseService) {}

  private normalizePais(pais: string) {
    const normalized = pais.trim();

    if (!normalized) {
      throw new BadRequestException('El país es obligatorio.');
    }

    return normalized;
  }

  private toEquipo(row: EquipoRow) {
    return {
      pais: row.pais,
      activo: Boolean(row.activo),
    };
  }

  async findAll(_role: Role) {
    const equipos = await this.databaseService.query<EquipoRow>(
      'SELECT pais, activo FROM EQUIPO WHERE activo = TRUE ORDER BY pais',
    );

    return equipos.map((equipo) => this.toEquipo(equipo));
  }

  async findOne(pais: string, _role: Role) {
    const normalizedPais = this.normalizePais(pais);
    const [equipo] = await this.databaseService.query<EquipoRow>(
      'SELECT pais, activo FROM EQUIPO WHERE pais = ? AND activo = TRUE LIMIT 1',
      [normalizedPais],
    );

    if (!equipo) {
      throw new NotFoundException(
        `No existe un equipo activo con país ${normalizedPais}.`,
      );
    }

    return this.toEquipo(equipo);
  }

  async create(dto: CreateEquipoDto, _role: Role) {
    const normalizedPais = this.normalizePais(dto.pais);
    const [existing] = await this.databaseService.query<EquipoRow>(
      'SELECT pais, activo FROM EQUIPO WHERE pais = ? LIMIT 1',
      [normalizedPais],
    );

    if (existing?.activo) {
      throw new ConflictException(`El equipo ${normalizedPais} ya existe.`);
    }

    if (existing && !existing.activo) {
      await this.databaseService.query(
        'UPDATE EQUIPO SET activo = TRUE WHERE pais = ?',
        [normalizedPais],
      );

      return this.toEquipo({ pais: normalizedPais, activo: true });
    }

    await this.databaseService.query(
      'INSERT INTO EQUIPO (pais, activo) VALUES (?, TRUE)',
      [normalizedPais],
    );

    return this.toEquipo({ pais: normalizedPais, activo: true });
  }

  async update(pais: string, dto: UpdateEquipoDto, _role: Role) {
    const currentPais = this.normalizePais(pais);
    const nextPais = this.normalizePais(dto.pais);

    const [currentEquipo] = await this.databaseService.query<EquipoRow>(
      'SELECT pais, activo FROM EQUIPO WHERE pais = ? AND activo = TRUE LIMIT 1',
      [currentPais],
    );

    if (!currentEquipo) {
      throw new NotFoundException(
        `No existe un equipo activo con país ${currentPais}.`,
      );
    }

    if (currentPais !== nextPais) {
      const [duplicate] = await this.databaseService.query<EquipoRow>(
        'SELECT pais, activo FROM EQUIPO WHERE pais = ? LIMIT 1',
        [nextPais],
      );

      if (duplicate) {
        throw new ConflictException(
          `Ya existe un equipo con país ${nextPais}.`,
        );
      }
    }

    await this.databaseService.query(
      'UPDATE EQUIPO SET pais = ? WHERE pais = ? AND activo = TRUE',
      [nextPais, currentPais],
    );

    return this.toEquipo({ pais: nextPais, activo: true });
  }

  async remove(pais: string, _role: Role) {
    const normalizedPais = this.normalizePais(pais);
    const [existing] = await this.databaseService.query<EquipoRow>(
      'SELECT pais, activo FROM EQUIPO WHERE pais = ? AND activo = TRUE LIMIT 1',
      [normalizedPais],
    );

    if (!existing) {
      throw new NotFoundException(
        `No existe un equipo activo con país ${normalizedPais}.`,
      );
    }

    await this.databaseService.query(
      'UPDATE EQUIPO SET activo = FALSE WHERE pais = ?',
      [normalizedPais],
    );

    return { pais: normalizedPais, activo: false };
  }
}
