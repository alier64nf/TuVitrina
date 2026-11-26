import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import PgBoss from 'pg-boss';

@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private boss: PgBoss | null = null;

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    const dbUrl = process.env.DATABASE_URL?.trim();
    if (!dbUrl) {
      this.logger.warn('DATABASE_URL no definida: pg-boss no se iniciará.');
      return;
    }
    try {
      this.boss = new PgBoss(dbUrl);
      this.boss.on('error', (err) => {
        this.logger.warn(`Error en pg-boss: ${err.message}`);
      });
      await this.boss.start();
    } catch (err) {
      this.logger.warn(
        `No se pudo iniciar pg-boss (${err instanceof Error ? err.message : String(err)}).`,
      );
      this.boss = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.boss) {
      await this.boss.stop().catch(() => undefined);
    }
  }
}
