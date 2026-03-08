import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { LogCleanupService } from './services/log-cleanup.service';
import { LogCleanupProcessor } from './processors/log-cleanup.processor';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Jobs Module
 * Manages background jobs using BullMQ queues with Redis
 */
@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'log-cleanup' },
    ),
    PrismaModule,
  ],
  providers: [
    LogCleanupService,
    LogCleanupProcessor,
  ],
  exports: [
    LogCleanupService,
  ],
})
export class JobsModule {}
