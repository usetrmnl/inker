import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { TerminusModule } from '@nestjs/terminus';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { DevicesModule } from './devices/devices.module';
import { ModelsModule } from './models/models.module';
import { ScreensModule } from './screens/screens.module';
import { PlaylistsModule } from './playlists/playlists.module';
import { ExtensionsModule } from './extensions/extensions.module';
import { DataSourcesModule } from './data-sources/data-sources.module';
import { CustomWidgetsModule } from './custom-widgets/custom-widgets.module';
import { FirmwareModule } from './firmware/firmware.module';
import { HealthModule } from './health/health.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ApiModule } from './api/api.module';
import { JobsModule } from './jobs/jobs.module';
import { CommonModule } from './common/common.module';
import { ScreenDesignerModule } from './screen-designer/screen-designer.module';
import { EventsModule } from './events/events.module';
import { SettingsModule } from './settings/settings.module';
import { configuration } from './config/configuration';
import { validationSchema } from './config/validation.schema';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      envFilePath: ['.env.local', '.env'],
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [{
        ttl: config.get<number>('throttle.ttl', 60) * 1000,
        limit: config.get<number>('throttle.limit', 100),
      }],
    }),

    // Queue management (BullMQ)
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host', 'localhost'),
          port: config.get<number>('redis.port', 6379),
          password: config.get<string>('redis.password'),
        },
      }),
    }),

    // Health checks
    TerminusModule,

    // Serve static files (uploaded widget images)
    // Use process.cwd() for consistent path resolution in Docker
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
      serveStaticOptions: {
        index: false,
      },
    }),

    // Core modules
    PrismaModule,
    CommonModule,
    HealthModule,

    // Feature modules
    AuthModule,
    ApiModule,
    DevicesModule,
    ModelsModule,
    ScreensModule,
    PlaylistsModule,
    ExtensionsModule,
    DataSourcesModule,
    CustomWidgetsModule,
    FirmwareModule,
    DashboardModule,
    JobsModule,
    ScreenDesignerModule,
    EventsModule,
    SettingsModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}