import { utilities as nestWinstonModuleUtilities } from 'nest-winston';
import * as winston from 'winston';

export function createLoggerConfig() {
  const format = process.env.LOG_FORMAT === 'simple'
    ? winston.format.simple()
    : winston.format.json();

  return {
    transports: [
      new winston.transports.Console({
        level: process.env.LOG_LEVEL || 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.ms(),
          nestWinstonModuleUtilities.format.nestLike('Inker', {
            prettyPrint: process.env.NODE_ENV !== 'production',
          }),
        ),
      }),
      ...(process.env.NODE_ENV === 'production'
        ? [
            new winston.transports.File({
              filename: 'logs/error.log',
              level: 'error',
              format,
            }),
            new winston.transports.File({
              filename: 'logs/combined.log',
              format,
            }),
          ]
        : []),
    ],
  };
}