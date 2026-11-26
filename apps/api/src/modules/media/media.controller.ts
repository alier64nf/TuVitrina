import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { signedUploadRequestSchema, type SignedUploadRequestInput } from '@tuvitrina/contracts';
import { CurrentUser, type RequestAuthUser } from '../../common/decorators/auth.decorators';
import { RateLimit } from '../../common/guards/redis-throttler.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { MediaService } from './media.service';

@ApiTags('Multimedia')
@ApiBearerAuth()
@Controller('api/v1/media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('signed-upload')
  @RateLimit({ limit: 30, windowSeconds: 60, keyPrefix: 'signed-upload' })
  @ApiOperation({
    summary: 'Genera una URL firmada para subir imágenes comprimidas (WebP/JPEG/PNG <= 2 MB) a Supabase Storage',
  })
  createSignedUpload(
    @CurrentUser() user: RequestAuthUser,
    @Body(new ZodValidationPipe(signedUploadRequestSchema)) body: SignedUploadRequestInput,
  ) {
    return this.mediaService.createSignedUploadUrl(user.profile!.id, body);
  }
}
