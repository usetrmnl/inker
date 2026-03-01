import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ModelPollerService } from './services/model-poller.service';
import { ModelPollerProcessor } from './processors/model-poller.processor';
import { LogCleanupService } from './services/log-cleanup.service';
import { LogCleanupProcessor } from './processors/log-cleanup.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { ModelsModule } from '../models/models.module';

/**
 * Jobs Module
 * Manages background jobs using BullMQ queues with Redis
 */
@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'model-poller' },
      { name: 'log-cleanup' },
    ),
    PrismaModule,
    ModelsModule,
  ],
  providers: [
    ModelPollerService,
    ModelPollerProcessor,
    LogCleanupService,
    LogCleanupProcessor,
  ],
  exports: [
    ModelPollerService,
    LogCleanupService,
  ],
})
export class JobsModule {}
