import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ApiController } from './api.controller';
import { DisplayService } from './display/display.service';
import { DefaultScreenService } from './display/default-screen.service';
import { SetupService } from './setup/setup.service';
import { SetupScreenService } from './setup/setup-screen.service';
import { LogService } from './log/log.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ScreenDesignerModule } from '../screen-designer/screen-designer.module';

@Module({
  imports: [
    PrismaModule,
    ScreenDesignerModule,
    // Serve static files from assets directory at /assets path
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'assets'),
      serveRoot: '/assets',
      serveStaticOptions: {
        index: false,
        fallthrough: true,
      },
    }),
    // Serve static files from uploads directory at /uploads path
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
      serveStaticOptions: {
        index: false,
        fallthrough: true,
      },
    }),
  ],
  controllers: [ApiController],
  providers: [DisplayService, DefaultScreenService, SetupService, SetupScreenService, LogService],
  exports: [DisplayService, DefaultScreenService, SetupService, SetupScreenService, LogService],
})
export class ApiModule {}
