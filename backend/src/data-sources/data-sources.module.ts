import { Module } from '@nestjs/common';
import { DataSourcesController } from './data-sources.controller';
import { DataSourcesService } from './data-sources.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DataSourcesController],
  providers: [DataSourcesService],
  exports: [DataSourcesService],
})
export class DataSourcesModule {}
