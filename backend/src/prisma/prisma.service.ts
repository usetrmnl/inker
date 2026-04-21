import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma service that manages database connection lifecycle.
 * Implements OnModuleInit to connect when the module initializes
 * and OnModuleDestroy to disconnect when the module is destroyed.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ],
    });

    // Log queries in development mode
    if (process.env.NODE_ENV === 'development') {
      this.$on('query' as never, (e: any) => {
        this.logger.debug(`Query: ${e.query} | Duration: ${e.duration}ms`);
      });
    }

    // Apply SQLite JSON fallback middleware
    if (process.env.DB_PROVIDER === 'sqlite') {
      const jsonFields = new Set([
        'config', 'headers', 'lastData', 'metadata', 'defaultConfig',
        'dataHeaders', 'settingsSchema', 'settings', 'settingsEncrypted'
      ]);

      const stringifyJsonFields = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        for (const key of Object.keys(obj)) {
          if (jsonFields.has(key)) {
            if (typeof obj[key] !== 'string' && obj[key] !== null && obj[key] !== undefined) {
              obj[key] = JSON.stringify(obj[key]);
            }
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            stringifyJsonFields(obj[key]);
          }
        }
      };

      const parseJsonFields = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        for (const key of Object.keys(obj)) {
          if (jsonFields.has(key)) {
            if (typeof obj[key] === 'string') {
              try {
                obj[key] = JSON.parse(obj[key]);
              } catch (e) {}
            }
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            parseJsonFields(obj[key]);
          }
        }
      };

      this.$use(async (params, next) => {
        if (params.args) {
          if (params.args.data) stringifyJsonFields(params.args.data);
          if (params.args.create) stringifyJsonFields(params.args.create);
          if (params.args.update) stringifyJsonFields(params.args.update);
          if (params.args.where) stringifyJsonFields(params.args.where); // For complex where clauses
        }

        const result = await next(params);

        if (result) {
          if (Array.isArray(result)) {
            result.forEach(parseJsonFields);
          } else {
            parseJsonFields(result);
          }
        }
        return result;
      });
    }
  }

  /**
   * Connect to the database when the module initializes
   */
  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Database connection established');
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  /**
   * Disconnect from the database when the module is destroyed
   * This ensures graceful shutdown and proper cleanup of connections
   */
  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('Database connection closed');
    } catch (error) {
      this.logger.error('Error disconnecting from database', error);
    }
  }

  /**
   * Clean all database tables (used for testing)
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production');
    }

    const models = Reflect.ownKeys(this).filter(
      (key) => key[0] !== '_' && key !== '$connect' && key !== '$disconnect',
    );

    return Promise.all(
      models.map((modelKey) => (this as any)[modelKey].deleteMany()),
    );
  }
}