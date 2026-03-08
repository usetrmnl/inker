import { Module } from '@nestjs/common';
import { ExtensionsController } from './extensions.controller';
import { ExtensionsService } from './extensions.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ExtensionsController],
  providers: [ExtensionsService],
  exports: [ExtensionsService],
})
export class ExtensionsModule {}
