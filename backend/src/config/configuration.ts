export const configuration = () => ({
  port: parseInt(process.env.PORT || '3002', 10),
  environment: process.env.NODE_ENV || 'development',

  api: {
    url: process.env.API_URL || `http://localhost:${process.env.PORT || '3002'}`,
  },

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },

  // Background jobs configuration
  jobs: {
    firmwarePoller: {
      enabled: process.env.FIRMWARE_POLLER_ENABLED !== 'false',
      interval: parseInt(
        process.env.FIRMWARE_POLLER_INTERVAL || '86400000',
        10,
      ), // 24 hours
    },
    modelPoller: {
      enabled: process.env.MODEL_POLLER_ENABLED !== 'false',
      interval: parseInt(process.env.MODEL_POLLER_INTERVAL || '86400000', 10), // 24 hours
    },
    screenPoller: {
      enabled: process.env.SCREEN_POLLER_ENABLED !== 'false',
      interval: parseInt(process.env.SCREEN_POLLER_INTERVAL || '900000', 10), // 15 minutes
    },
  },

  // External APIs
  models: {
    apiUrl: process.env.MODELS_API_URL,
  },

  github: {
    token: process.env.GITHUB_TOKEN, // Optional - increases rate limit from 60/hr to 5000/hr
  },

  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL || '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
  },

  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
    screensDir: process.env.SCREENS_DIR || './uploads/screens',
    firmwareDir: process.env.FIRMWARE_DIR || './uploads/firmware',
  },

  device: {
    apiKeyLength: 32,
    pollingInterval: parseInt(process.env.DEVICE_POLLING_INTERVAL || '60000', 10), // 1 minute
    offlineThreshold: parseInt(process.env.DEVICE_OFFLINE_THRESHOLD || '300000', 10), // 5 minutes
  },

  admin: {
    pin: process.env.ADMIN_PIN || '1111',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
  },

  // Default timezone for server-side rendering (e.g., clock/date widgets)
  // Docker containers default to UTC, so this provides a configurable default
  defaultTimezone: process.env.DEFAULT_TIMEZONE || 'UTC',
});