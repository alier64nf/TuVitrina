import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

interface MemoryLimitEntry {
  count: number;
  resetAt: number;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private available = false;
  private readonly memoryRateLimits = new Map<string, MemoryLimitEntry>();

  async onModuleInit(): Promise<void> {
    const redisUrl = process.env.REDIS_URL?.trim();
    if (!redisUrl) {
      this.logger.warn('REDIS_URL no definida: usando respaldo en memoria para rate limiting.');
      return;
    }

    try {
      this.client = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        retryStrategy: () => null,
      });

      this.client.on('error', (err) => {
        if (this.available) {
          this.logger.warn(`Redis desconectado (${err.message}); degradando caché y rate-limit.`);
        }
        this.available = false;
      });

      this.client.on('ready', () => {
        this.available = true;
      });

      await this.client.connect();
      await this.client.ping();
      this.available = true;
    } catch (err) {
      this.logger.warn(
        `Redis no disponible al iniciar (${err instanceof Error ? err.message : String(err)}). Operando en modo degradado.`,
      );
      this.available = false;
      if (this.client) {
        this.client.disconnect();
        this.client = null;
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit().catch(() => undefined);
    }
  }

  async getStatus(): Promise<'up' | 'degraded'> {
    if (!this.client || !this.available) return 'degraded';
    try {
      await this.client.ping();
      return 'up';
    } catch {
      this.available = false;
      return 'degraded';
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    if (!this.client || !this.available) return null;
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
    if (!this.client || !this.available) return;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // Graceful fallback
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client || !this.available) return;
    try {
      await this.client.del(key);
    } catch {
      // Graceful fallback
    }
  }

  async incrementRateLimit(
    key: string,
    windowSeconds: number,
  ): Promise<{ count: number; ttlSeconds: number }> {
    if (this.client && this.available) {
      try {
        const count = await this.client.incr(key);
        if (count === 1) {
          await this.client.expire(key, windowSeconds);
        }
        const ttl = await this.client.ttl(key);
        return { count, ttlSeconds: ttl > 0 ? ttl : windowSeconds };
      } catch {
        this.available = false;
      }
    }

    const now = Date.now();
    const existing = this.memoryRateLimits.get(key);
    if (!existing || existing.resetAt <= now) {
      const resetAt = now + windowSeconds * 1000;
      this.memoryRateLimits.set(key, { count: 1, resetAt });
      return { count: 1, ttlSeconds: windowSeconds };
    }
    existing.count += 1;
    return {
      count: existing.count,
      ttlSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
}
