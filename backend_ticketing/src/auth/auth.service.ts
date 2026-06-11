import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto, LoginDto, RegisterFuncionarioDto } from './auth.dto';
import { Role } from './roles.enum';
import type { AuthUser } from './decorators';
import { DatabaseService } from '../database/database.service';
import type { QueryParam } from '../database/database.service';

interface UsuarioRow {
  id_usuario: number;
  mail: string;
  contrasena: string;
  activo: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private db: DatabaseService,
  ) {}

  async register(dto: RegisterDto) {
    await this.checkUsuarioDisponible(dto);

    const hash = await bcrypt.hash(dto.contrasena, 10);

    const userId = await this.db.withTransaction(async (query) => {
      const id = await this.insertUsuario(query, dto, hash);

      await query('INSERT INTO USUARIO_GENERAL (id_usuario) VALUES (?)', [id]);

      return id;
    });

    return this.generateToken(userId, Role.CLIENTE);
  }

  async login(dto: LoginDto) {
    const [usuario] = await this.db.query<UsuarioRow>(
      'SELECT id_usuario, contrasena, activo FROM USUARIO WHERE mail = ?',
      [dto.mail],
    );

    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordMatch = await bcrypt.compare(
      dto.contrasena,
      usuario.contrasena,
    );
    if (!passwordMatch) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const role = await this.resolveRole(usuario.id_usuario);
    return this.generateToken(usuario.id_usuario, role);
  }

  async registerFuncionario(dto: RegisterFuncionarioDto, user: AuthUser) {
    await this.checkUsuarioDisponible(dto, user.role);

    const [legajo] = await this.db.query<{ id_usuario: number }>(
      'SELECT id_usuario FROM FUNCIONARIO_VALIDACION WHERE numero_legajo = ?',
      [dto.numero_legajo],
      user.role,
    );
    if (legajo) {
      throw new ConflictException('El número de legajo ya está registrado');
    }

    const hash = await bcrypt.hash(dto.contrasena, 10);

    await this.db.withTransaction(async (query) => {
      const id = await this.insertUsuario(query, dto, hash);

      await query(
        'INSERT INTO FUNCIONARIO_VALIDACION (id_usuario, numero_legajo) VALUES (?, ?)',
        [id, dto.numero_legajo],
      );
    }, user.role);

    return { message: 'Funcionario registrado correctamente' };
  }

  logout() {
    return { message: 'Logout exitoso' };
  }

  generateToken(userId: number, role: Role) {
    return {
      access_token: this.jwtService.sign({ sub: userId, role }),
    };
  }

  private async checkUsuarioDisponible(dto: RegisterDto, role?: Role) {
    const existingMail = await this.db.query<UsuarioRow>(
      'SELECT id_usuario FROM USUARIO WHERE mail = ?',
      [dto.mail],
      role,
    );
    if (existingMail.length > 0) {
      throw new ConflictException('El mail ya está registrado');
    }

    const existingDoc = await this.db.query<UsuarioRow>(
      'SELECT id_usuario FROM USUARIO WHERE doc_pais = ? AND doc_tipo = ? AND doc_numero = ?',
      [dto.doc_pais, dto.doc_tipo, dto.doc_numero],
      role,
    );
    if (existingDoc.length > 0) {
      throw new ConflictException('El documento ya está registrado');
    }
  }

  private async insertUsuario(
    query: <R = unknown>(sql: string, params?: QueryParam[]) => Promise<R[]>,
    dto: RegisterDto,
    hash: string,
  ): Promise<number> {
    const result = await query(
      `INSERT INTO USUARIO
        (doc_pais, doc_tipo, doc_numero, mail, contrasena,
         dir_pais, dir_localidad, dir_calle, dir_numero, dir_codigo_postal)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dto.doc_pais,
        dto.doc_tipo,
        dto.doc_numero,
        dto.mail,
        hash,
        dto.dir_pais,
        dto.dir_localidad,
        dto.dir_calle,
        dto.dir_numero,
        dto.dir_codigo_postal,
      ],
    );

    const id = (result as unknown as { insertId: number }).insertId;

    const telefonos = [...new Set(dto.telefonos ?? [])];
    for (const telefono of telefonos) {
      await query(
        'INSERT INTO TELEFONO_USUARIO (id_usuario, telefono) VALUES (?, ?)',
        [id, telefono],
      );
    }

    return id;
  }

  private async resolveRole(userId: number): Promise<Role> {
    const [admin] = await this.db.query<{ id_usuario: number }>(
      'SELECT id_usuario FROM ADMIN_POR_SEDE WHERE id_usuario = ? AND activo = TRUE',
      [userId],
    );
    if (admin) return Role.ADMIN;

    const [funcionario] = await this.db.query<{ id_usuario: number }>(
      'SELECT id_usuario FROM FUNCIONARIO_VALIDACION WHERE id_usuario = ? AND activo = TRUE',
      [userId],
    );
    if (funcionario) return Role.FUNCIONARIO;

    const [cliente] = await this.db.query<{ id_usuario: number }>(
      'SELECT id_usuario FROM USUARIO_GENERAL WHERE id_usuario = ? AND activo = TRUE',
      [userId],
    );
    if (!cliente) throw new UnauthorizedException('Credenciales inválidas');

    return Role.CLIENTE;
  }
}
