import { Module } from '@nestjs/common';
import { FirmwareController } from './firmware.controller';
import { FirmwareService } from './firmware.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FirmwareController],
  providers: [FirmwareService],
  exports: [FirmwareService],
})
export class FirmwareModule {}
