import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import type { RequestAuthUser } from '../decorators/auth.decorators';
import { RedisService } from '../../infrastructure/redis/redis.service';

export interface RateLimitPolicy {
  limit: number;
  windowSeconds: number;
  keyPrefix?: string;
}

export const RATE_LIMIT_KEY = 'tuvitrina_rate_limit';
export const RateLimit = (policy: RateLimitPolicy) => SetMetadata(RATE_LIMIT_KEY, policy);

@Injectable()
export class RedisThrottlerGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policy = this.reflector.getAllAndOverride<RateLimitPolicy>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? { limit: 120, windowSeconds: 60, keyPrefix: 'global' };

    const req = context.switchToHttp().getRequest<Request & { authUser?: RequestAuthUser }>();
    const res = context.switchToHttp().getResponse<Response>();

    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      req.ip ||
      'unknown';
    const userId = req.authUser?.uid ?? 'anon';
    const routeKey = `${policy.keyPrefix ?? 'route'}:${req.method}:${req.route?.path ?? req.path}`;
    const key = `rl:${routeKey}:ip:${ip}:u:${userId}`;

    const { count, ttlSeconds } = await this.redis.incrementRateLimit(key, policy.windowSeconds);
    res.setHeader('X-RateLimit-Limit', String(policy.limit));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, policy.limit - count)));
    res.setHeader('X-RateLimit-Reset', String(ttlSeconds));

    if (count > policy.limit) {
      throw new HttpException(
        {
          type: 'https://tuvitrina.cu/errors/rate-limit',
          title: 'Demasiadas solicitudes',
          status: HttpStatus.TOO_MANY_REQUESTS,
          detail: `Has superado el límite de solicitudes. Intenta nuevamente en ${ttlSeconds} segundos.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
