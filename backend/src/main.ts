import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const compression = require('compression');
import { WinstonModule } from 'nest-winston';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { createLoggerConfig } from './config/logger.config';

async function bootstrap() {
  // Create logger instance
  const logger = WinstonModule.createLogger(createLoggerConfig());

  const app = await NestFactory.create(AppModule, {
    logger,
  });

  // Get config service
  const configService = app.get(ConfigService);
  const port = configService.get<number>('port', 3000);
  const environment = configService.get<string>('environment', 'development');

  // Security middleware - allow cross-origin resource loading for images
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: environment === 'production',
  }));
  app.use(compression());

  // Enable CORS - restrict origins via CORS_ORIGINS env (comma-separated), defaults to all
  const corsOrigins = process.env.CORS_ORIGINS || '*';
  if (corsOrigins === '*') {
    app.enableCors();
  } else {
    app.enableCors({
      origin: corsOrigins.split(',').map((o) => o.trim()),
      credentials: true,
    });
  }

  // Global prefix - exclude /api routes since they're for device communication
  app.setGlobalPrefix('api', {
    exclude: ['health', 'ready', 'api/display', 'api/setup', 'api/setup/', 'api/log', 'api/device-images/design/:id', 'api/device-images/device/:id'],
  });

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global filters
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global interceptors
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger documentation setup
  if (environment !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Inker API')
      .setDescription('API documentation for Inker e-ink device management server')
      .setVersion('1.0.0-Alpha')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', name: 'X-Device-Key', in: 'header' }, 'device-key')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Graceful shutdown handling
  const shutdownSignals = ['SIGTERM', 'SIGINT'];
  shutdownSignals.forEach((signal) => {
    process.on(signal, async () => {
      logger.log(`Received ${signal}, starting graceful shutdown...`);
      try {
        await app.close();
        logger.log('Application closed successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    });
  });

  await app.listen(port, '0.0.0.0');
  logger.log(`Inker Server running in ${environment} mode on port ${port} (listening on all interfaces)`);

  // Warn if using default PIN
  const adminPin = process.env.ADMIN_PIN || '1111';
  if (adminPin === '1111') {
    logger.warn('WARNING: Using default ADMIN_PIN "1111". Change it via the ADMIN_PIN environment variable for security.');
  }

  if (environment !== 'production') {
    logger.log(`📚 API Documentation available at http://localhost:${port}/api/docs`);
  }
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});