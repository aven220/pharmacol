import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SYNC_QUEUE, SyncProcessor } from './sync.processor';
import { SyncScheduler } from './sync.scheduler';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [
    BullModule.registerQueueAsync({
      name: SYNC_QUEUE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.get<string>('REDIS_URL') },
      }),
    }),
  ],
  controllers: [SyncController],
  providers: [SyncService, SyncProcessor, SyncScheduler],
  exports: [SyncService],
})
export class SyncModule {}
