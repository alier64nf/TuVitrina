import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { updateUserProfileSchema, type UpdateUserProfileInput } from '@tuvitrina/contracts';
import { CurrentUser, type RequestAuthUser } from '../../common/decorators/auth.decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthService, mapProfileDto } from '../auth/auth.service';
import { StoresService } from '../stores/stores.service';

@ApiTags('Usuario')
@ApiBearerAuth()
@Controller('api/v1/users')
export class UsersController {
  constructor(
    private readonly authService: AuthService,
    private readonly storesService: StoresService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Obtiene el perfil y la tienda del usuario autenticado' })
  async getMe(@CurrentUser() user: RequestAuthUser) {
    const profile = user.profile!;
    const store = await this.storesService.findSummaryByOwner(profile.id);
    return {
      profile: mapProfileDto(profile),
      store,
    };
  }

  @Patch('me')
  @ApiOperation({ summary: 'Actualiza nombre o teléfono del perfil sin modificar el rol' })
  async updateMe(
    @CurrentUser() user: RequestAuthUser,
    @Body(new ZodValidationPipe(updateUserProfileSchema)) body: UpdateUserProfileInput,
  ) {
    return this.authService.updateMe(user.profile!.id, body);
  }
}
