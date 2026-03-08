import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

/**
 * Model Poller Processor
 * Polls Core Models API for new or updated device models
 * Syncs device model definitions (screen dimensions, capabilities, etc.)
 */
@Processor('model-poller')
export class ModelPollerProcessor extends WorkerHost {
  private readonly logger = new Logger(ModelPollerProcessor.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    super();
  }

  async process(job: Job) {
    this.logger.log('Processing model poll job...');

    try {
      const modelsApiUrl = this.configService.get<string>('models.apiUrl');

      if (!modelsApiUrl) {
        this.logger.debug(
          'Models API URL not configured, skipping external poll',
        );
        return await this.checkLocalModels();
      }

      // Fetch models from external API
      const response = await axios.get(modelsApiUrl, {
        timeout: 10000,
      });

      const externalModels = response.data;

      if (!Array.isArray(externalModels)) {
        throw new Error('Invalid response from models API');
      }

      // Sync models to database
      let created = 0;
      let updated = 0;

      for (const modelData of externalModels) {
        const existingModel = await this.prisma.model.findUnique({
          where: { name: modelData.name },
        });

        if (existingModel) {
          // Update existing model if data changed
          await this.prisma.model.update({
            where: { id: existingModel.id },
            data: {
              label: modelData.label,
              width: modelData.width,
              height: modelData.height,
              description: modelData.description,
              colors: modelData.colors || 2,
              bitDepth: modelData.bitDepth || 1,
            },
          });
          updated++;
        } else {
          // Create new model
          await this.prisma.model.create({
            data: {
              name: modelData.name,
              label: modelData.label,
              width: modelData.width,
              height: modelData.height,
              description: modelData.description,
              colors: modelData.colors || 2,
              bitDepth: modelData.bitDepth || 1,
            },
          });
          created++;
        }
      }

      this.logger.log(
        `Model sync complete. Created: ${created}, Updated: ${updated}`,
      );

      return {
        success: true,
        created,
        updated,
        total: externalModels.length,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.warn(`Models API unreachable: ${error.message}`);
        return await this.checkLocalModels();
      }

      this.logger.error('Model poll failed:', error);
      throw error;
    }
  }

  private async checkLocalModels() {
    const modelCount = await this.prisma.model.count();
    this.logger.log(`Local model check complete. Total models: ${modelCount}`);

    return {
      success: true,
      modelCount,
      source: 'local',
    };
  }
}
