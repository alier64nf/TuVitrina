import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

export interface ProblemDetailsBody {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  errors?: Array<{ path: string; message: string }>;
}

const TITLES: Record<number, string> = {
  400: 'Solicitud inválida',
  401: 'No autenticado',
  403: 'Acceso denegado',
  404: 'Recurso no encontrado',
  409: 'Conflicto con el estado actual',
  413: 'Archivo o solicitud demasiado grande',
  422: 'Error de validación',
  429: 'Demasiadas solicitudes',
  500: 'Error interno del servidor',
  503: 'Servicio temporalmente no disponible',
};

@Catch()
export class Rfc7807ExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(Rfc7807ExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = TITLES[status];
    let detail = 'Ocurrió un error inesperado. Intenta de nuevo en unos instantes.';
    let type = 'https://tuvitrina.cu/errors/internal';
    let errors: Array<{ path: string; message: string }> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      title = TITLES[status] ?? exception.name;
      const response = exception.getResponse();

      if (typeof response === 'string') {
        detail = response;
      } else if (response && typeof response === 'object') {
        const obj = response as Record<string, unknown>;
        if (typeof obj.title === 'string') title = obj.title;
        if (typeof obj.type === 'string') type = obj.type;
        if (typeof obj.detail === 'string') {
          detail = obj.detail;
        } else if (typeof obj.message === 'string') {
          detail = obj.message;
        } else if (Array.isArray(obj.message)) {
          detail = obj.message.join(' ');
        }
        if (Array.isArray(obj.errors)) {
          errors = obj.errors as Array<{ path: string; message: string }>;
        }
      }
      if (type === 'https://tuvitrina.cu/errors/internal' && status < 500) {
        type = `https://tuvitrina.cu/errors/http-${status}`;
      }
    } else if (exception instanceof Error) {
      this.logger.error({ err: exception.message, path: req.url }, exception.stack);
      const prismaCode = (exception as { code?: string }).code;
      if (prismaCode === 'P2002') {
        status = HttpStatus.CONFLICT;
        title = TITLES[status];
        type = 'https://tuvitrina.cu/errors/conflict';
        detail = 'Ya existe un registro con esos mismos datos únicos.';
      } else if (prismaCode === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        title = TITLES[status];
        type = 'https://tuvitrina.cu/errors/not-found';
        detail = 'El recurso solicitado no existe.';
      }
    }

    const body: ProblemDetailsBody = {
      type,
      title,
      status,
      detail,
      instance: req.originalUrl || req.url,
      ...(errors ? { errors } : {}),
    };

    res.status(status).type('application/problem+json').json(body);
  }
}
