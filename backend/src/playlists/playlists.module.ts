import { Module } from '@nestjs/common';
import { PlaylistsController } from './playlists.controller';
import { PlaylistsService } from './playlists.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PlaylistsController],
  providers: [PlaylistsService],
  exports: [PlaylistsService],
})
export class PlaylistsModule {}
