import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe<T = unknown> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const issues = result.error.issues.map((issue) => ({
        path: issue.path.join('.') || 'body',
        message: issue.message,
      }));
      throw new BadRequestException({
        type: 'https://tuvitrina.cu/errors/validation',
        title: 'Error de validación',
        detail: issues[0]?.message ?? 'Revisa los datos enviados.',
        errors: issues,
      });
    }
    return result.data;
  }
}
