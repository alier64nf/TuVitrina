import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { Rfc7807ExceptionFilter } from './common/filters/rfc7807-exception.filter';
import { RedisThrottlerGuard } from './common/guards/redis-throttler.guard';
import { RolesGuard } from './common/guards/roles.guard';
import {
  SupabaseJwksTokenVerifier,
  SupabaseJwtGuard,
  TOKEN_VERIFIER,
} from './common/guards/supabase-jwt.guard';
import { CryptoModule } from './infrastructure/crypto/crypto.module';
import { JobsService } from './infrastructure/jobs/jobs.service';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { HealthModule } from './modules/health/health.module';
import { MarketingModule } from './modules/marketing/marketing.module';
import { MediaModule } from './modules/media/media.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ShippingModule } from './modules/shipping/shipping.module';
import { StorefrontModule } from './modules/storefront/storefront.module';
import { StoresModule } from './modules/stores/stores.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { SupportModule } from './modules/support/support.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    CryptoModule,
    HealthModule,
    AuthModule,
    UsersModule,
    StoresModule,
    CatalogModule,
    MediaModule,
    StorefrontModule,
    OrdersModule,
    PaymentsModule,
    ShippingModule,
    SubscriptionsModule,
    ReportsModule,
    AdminModule,
    MarketingModule,
    SupportModule,
  ],
  providers: [
    JobsService,
    { provide: TOKEN_VERIFIER, useClass: SupabaseJwksTokenVerifier },
    { provide: APP_FILTER, useClass: Rfc7807ExceptionFilter },
    { provide: APP_GUARD, useClass: SupabaseJwtGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: RedisThrottlerGuard },
  ],
})
export class AppModule {}
