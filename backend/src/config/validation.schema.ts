import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'staging')
    .default('development'),
  PORT: Joi.number().default(3000),

  // Database
  DATABASE_URL: Joi.string().required(),

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().optional().allow(''),

  // Rate limiting
  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(100),

  // File uploads
  MAX_FILE_SIZE: Joi.number().default(10485760),
  SCREENS_DIR: Joi.string().default('./uploads/screens'),
  FIRMWARE_DIR: Joi.string().default('./uploads/firmware'),

  // Device configuration
  DEVICE_POLLING_INTERVAL: Joi.number().default(60000),
  DEVICE_OFFLINE_THRESHOLD: Joi.number().default(300000),

  // Logging
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug', 'verbose')
    .default('info'),
  LOG_FORMAT: Joi.string().valid('json', 'simple').default('json'),
});