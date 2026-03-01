import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';

@Processor('log-cleanup')
export class LogCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(LogCleanupProcessor.name);

  constructor(private prisma: PrismaService) {
    super();
  }

  async process(job: Job) {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    this.logger.log(`Cleaning up device logs older than ${cutoff.toISOString()}`);

    const result = await this.prisma.deviceLog.deleteMany({
      where: {
        createdAt: { lt: cutoff },
      },
    });

    this.logger.log(`Deleted ${result.count} old device log entries`);

    return { deleted: result.count };
  }
}
