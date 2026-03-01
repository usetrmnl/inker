import { Module } from '@nestjs/common';
import { CustomWidgetsController } from './custom-widgets.controller';
import { CustomWidgetsService } from './custom-widgets.service';
import { ScriptExecutorService } from './services/script-executor.service';
import { PrismaModule } from '../prisma/prisma.module';
import { DataSourcesModule } from '../data-sources/data-sources.module';

@Module({
  imports: [PrismaModule, DataSourcesModule],
  controllers: [CustomWidgetsController],
  providers: [CustomWidgetsService, ScriptExecutorService],
  exports: [CustomWidgetsService],
})
export class CustomWidgetsModule {}
