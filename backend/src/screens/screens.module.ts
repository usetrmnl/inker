import { Module } from '@nestjs/common';
import { ScreensController } from './screens.controller';
import { ScreensService } from './screens.service';
import { ImageProcessorService } from './services/image-processor.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ScreenDesignerModule } from '../screen-designer/screen-designer.module';

@Module({
  imports: [PrismaModule, ScreenDesignerModule],
  controllers: [ScreensController],
  providers: [
    ScreensService,
    ImageProcessorService,
  ],
  exports: [
    ScreensService,
    ImageProcessorService,
  ],
})
export class ScreensModule {}
