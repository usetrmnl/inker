import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PinAuthService } from './pin-auth.service';
import { AuthController } from './auth.controller';
import { PinAuthGuard } from './guards/pin-auth.guard';

@Module({
  controllers: [AuthController],
  providers: [
    PinAuthService,
    {
      provide: APP_GUARD,
      useClass: PinAuthGuard,
    },
  ],
  exports: [PinAuthService],
})
export class AuthModule {}
