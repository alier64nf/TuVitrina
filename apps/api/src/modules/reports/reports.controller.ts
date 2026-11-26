import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createReportSchema, type CreateReportInput } from '@tuvitrina/contracts';
import { Public } from '../../common/decorators/auth.decorators';
import { RateLimit } from '../../common/guards/redis-throttler.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ReportsService } from './reports.service';

@ApiTags('Reportes Públicos')
@Controller('api/v1/storefronts')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post(':slug/reports')
  @Public()
  @RateLimit({ limit: 5, windowSeconds: 60, keyPrefix: 'report-store' })
  @ApiOperation({ summary: 'Reporta una tienda o producto por incumplimiento de políticas de contenido' })
  createReport(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(createReportSchema)) body: CreateReportInput,
  ) {
    return this.reportsService.createReport(slug, body);
  }
}
