import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Request } from 'express';
import {
  ALLOW_UNPROFILED_KEY,
  IS_PUBLIC_KEY,
  type RequestAuthUser,
} from '../decorators/auth.decorators';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export const TOKEN_VERIFIER = 'TUVITRINA_TOKEN_VERIFIER';

export interface VerifiedJwtClaims {
  sub: string;
  email?: string;
}

export interface TokenVerifier {
  verify(token: string): Promise<VerifiedJwtClaims>;
}

@Injectable()
export class SupabaseJwksTokenVerifier implements TokenVerifier {
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  private getJwks() {
    if (this.jwks) return this.jwks;
    const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
    const jwksUrl =
      process.env.SUPABASE_JWKS_URL ||
      (supabaseUrl ? `${supabaseUrl}/auth/v1/.well-known/jwks.json` : '');
    if (!jwksUrl) {
      throw new UnauthorizedException(
        'Autenticación no configurada en el servidor (SUPABASE_JWKS_URL).',
      );
    }
    this.jwks = createRemoteJWKSet(new URL(jwksUrl));
    return this.jwks;
  }

  async verify(token: string): Promise<VerifiedJwtClaims> {
    const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
    const issuer =
      process.env.SUPABASE_JWT_ISSUER || (supabaseUrl ? `${supabaseUrl}/auth/v1` : undefined);
    const { payload } = await jwtVerify(token, this.getJwks(), {
      ...(issuer ? { issuer } : {}),
      audience: 'authenticated',
    });
    if (!payload.sub) {
      throw new UnauthorizedException('Token inválido: falta el identificador de usuario.');
    }
    return {
      sub: String(payload.sub),
      email: typeof payload.email === 'string' ? payload.email : undefined,
    };
  }
}

@Injectable()
export class SupabaseJwtGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    @Optional() @Inject(TOKEN_VERIFIER) private readonly tokenVerifier?: TokenVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { authUser?: RequestAuthUser }>();
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Debes iniciar sesión para continuar.');
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Token de sesión vacío.');
    }

    let claims: VerifiedJwtClaims;
    try {
      const verifier = this.tokenVerifier ?? new SupabaseJwksTokenVerifier();
      claims = await verifier.verify(token);
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Tu sesión expiró o no es válida. Vuelve a iniciar sesión.');
    }

    const profile = this.prisma.isConfigured()
      ? await this.prisma.profile.findUnique({ where: { id: claims.sub } })
      : null;

    const allowUnprofiled = this.reflector.getAllAndOverride<boolean>(ALLOW_UNPROFILED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!profile && !allowUnprofiled) {
      throw new ForbiddenException(
        'Completa la activación inicial de tu perfil y acepta los términos para continuar.',
      );
    }

    req.authUser = {
      uid: claims.sub,
      email: claims.email ?? profile?.email ?? '',
      profile,
    };
    return true;
  }
}
