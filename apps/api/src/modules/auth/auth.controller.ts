import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { syncProfileSchema, type SyncProfileInput } from '@tuvitrina/contracts';
import {
  AllowUnprofiled,
  CurrentUser,
  type RequestAuthUser,
} from '../../common/decorators/auth.decorators';
import { RateLimit } from '../../common/guards/redis-throttler.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { StoresService } from '../stores/stores.service';
import { AuthService } from './auth.service';

@ApiTags('Autenticación')
@ApiBearerAuth()
@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly storesService: StoresService,
  ) {}

  @Post('sync-profile')
  @AllowUnprofiled()
  @RateLimit({ limit: 20, windowSeconds: 60, keyPrefix: 'sync-profile' })
  @ApiOperation({
    summary: 'Crea o sincroniza el perfil del usuario autenticado con aceptación versionada de términos',
  })
  async syncProfile(
    @CurrentUser() user: RequestAuthUser,
    @Body(new ZodValidationPipe(syncProfileSchema)) body: SyncProfileInput,
  ) {
    return this.authService.syncProfile(user.uid, user.email, body, (ownerId) =>
      this.storesService.findSummaryByOwner(ownerId),
    );
  }
}
