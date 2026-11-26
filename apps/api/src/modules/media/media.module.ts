import { Module } from '@nestjs/common';
import { StoresModule } from '../stores/stores.module';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

@Module({
  imports: [StoresModule],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
