import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StoresModule } from '../stores/stores.module';
import { UsersController } from './users.controller';

@Module({
  imports: [AuthModule, StoresModule],
  controllers: [UsersController],
})
export class UsersModule {}
