import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';

@ApiTags('Salud')
@Controller('api/v1/health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Verifica estado de la API, PostgreSQL y Redis' })
  async getHealth() {
    const [postgres, redis] = await Promise.all([
      this.prisma.checkHealth(),
      this.redis.getStatus(),
    ]);
    return {
      ok: postgres !== 'down',
      postgres,
      redis,
      timestamp: new Date().toISOString(),
    };
  }
}
