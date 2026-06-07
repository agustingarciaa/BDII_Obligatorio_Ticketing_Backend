import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import mysql from 'mysql2/promise';
import { Role } from '../auth/roles.enum';

type PoolKey = Role | 'sistema';
type QueryParam = string | number | boolean | null | Buffer | Date;

const DB_USERS: Record<
  PoolKey,
  { user: string; passwordEnv: string; defaultPassword: string }
> = {
  sistema: {
    user: 'ticketing_sistema',
    passwordEnv: 'DB_SISTEMA_PASSWORD',
    defaultPassword: 'sistema_pass',
  },
  [Role.ADMIN]: {
    user: 'ticketing_admin',
    passwordEnv: 'DB_ADMIN_PASSWORD',
    defaultPassword: 'admin_pass',
  },
  [Role.CLIENTE]: {
    user: 'ticketing_usuario_general',
    passwordEnv: 'DB_USUARIO_PASSWORD',
    defaultPassword: 'usuario_pass',
  },
  [Role.FUNCIONARIO]: {
    user: 'ticketing_funcionario_validacion',
    passwordEnv: 'DB_FUNCIONARIO_PASSWORD',
    defaultPassword: 'funcionario_pass',
  },
};

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pools = new Map<PoolKey, mysql.Pool>();

  onModuleInit() {
    const base = {
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 3306),
      database: process.env.DB_NAME ?? 'ticketing_db',
      waitForConnections: true,
      connectionLimit: 10,
    };

    for (const [key, cfg] of Object.entries(DB_USERS) as [
      PoolKey,
      (typeof DB_USERS)[PoolKey],
    ][]) {
      this.pools.set(
        key,
        mysql.createPool({
          ...base,
          user: cfg.user,
          password: process.env[cfg.passwordEnv] ?? cfg.defaultPassword,
        }),
      );
    }
  }

  async onModuleDestroy() {
    await Promise.all([...this.pools.values()].map((p) => p.end()));
  }

  async query<T = unknown>(
    sql: string,
    params?: QueryParam[],
    role?: Role,
  ): Promise<T[]> {
    const pool = this.pools.get(role ?? 'sistema')!;
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(sql, params);
    return rows as T[];
  }
}
