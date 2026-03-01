import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';

/**
 * Model Poller Service
 * Polls the Core Models API for new or updated device models
 * Similar to Ruby's Models::Poller aspect
 */
@Injectable()
export class ModelPollerService implements OnModuleInit {
  private readonly logger = new Logger(ModelPollerService.name);

  constructor(
    @InjectQueue('model-poller') private modelQueue: Queue,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    const enabled = this.configService.get<boolean>(
      'jobs.modelPoller.enabled',
      true,
    );

    if (!enabled) {
      this.logger.log('Model poller is disabled');
      return;
    }

    await this.startPoller();
  }

  private async startPoller() {
    // Poll every 24 hours by default
    const interval = this.configService.get<number>(
      'jobs.modelPoller.interval',
      86400000, // 24 hours in milliseconds
    );

    this.logger.log(`Starting model poller with interval: ${interval / 1000}s`);

    // Add repeatable job
    await this.modelQueue.add(
      'poll-models',
      {},
      {
        repeat: {
          every: interval,
        },
        removeOnComplete: true,
        removeOnFail: { count: 10 },
      },
    );

    // Run immediately on startup
    await this.modelQueue.add('poll-models', {}, { delay: 5000, removeOnComplete: true, removeOnFail: true });

    this.logger.log('Model poller started');
  }

  async stopPoller() {
    // Clean completed and failed jobs (grace period 0ms)
    await this.modelQueue.clean(0, 0, 'completed');
    await this.modelQueue.clean(0, 0, 'failed');
    await this.modelQueue.drain();

    const repeatableJobs = await this.modelQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await this.modelQueue.removeRepeatableByKey(job.key);
    }

    this.logger.log('Model poller stopped');
  }
}
