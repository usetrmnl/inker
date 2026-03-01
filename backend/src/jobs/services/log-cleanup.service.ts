import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class LogCleanupService implements OnModuleInit {
  private readonly logger = new Logger(LogCleanupService.name);

  constructor(
    @InjectQueue('log-cleanup') private logCleanupQueue: Queue,
  ) {}

  async onModuleInit() {
    await this.startCleanupJob();
  }

  private async startCleanupJob() {
    const interval = 24 * 60 * 60 * 1000; // 24 hours

    this.logger.log('Starting device log cleanup job (daily)');

    await this.logCleanupQueue.add(
      'cleanup-logs',
      {},
      {
        repeat: { every: interval },
        removeOnComplete: true,
        removeOnFail: { count: 5 },
      },
    );

    // Run once on startup after a short delay
    await this.logCleanupQueue.add('cleanup-logs', {}, {
      delay: 30000,
      removeOnComplete: true,
      removeOnFail: true,
    });

    this.logger.log('Device log cleanup job scheduled');
  }
}
