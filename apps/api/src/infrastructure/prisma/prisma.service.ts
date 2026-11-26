import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private connected = false;

  isConfigured(): boolean {
    return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
  }

  ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Base de datos no configurada. Define DATABASE_URL en las variables de entorno del servidor.',
      );
    }
  }

  async onModuleInit(): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn('DATABASE_URL no definida: Prisma iniciará en modo diferido.');
      return;
    }
    try {
      await this.$connect();
      this.connected = true;
    } catch (err) {
      this.logger.warn(
        `No se pudo conectar a PostgreSQL al iniciar (${err instanceof Error ? err.message : String(err)}). Se reintentará en las consultas.`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connected) {
      await this.$disconnect();
    }
  }

  async checkHealth(): Promise<'up' | 'unconfigured' | 'down'> {
    if (!this.isConfigured()) return 'unconfigured';
    try {
      await this.$queryRaw`SELECT 1`;
      return 'up';
    } catch {
      return 'down';
    }
  }
}
