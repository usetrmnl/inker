import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PlaylistsService } from './playlists.service';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { AddPlaylistItemDto } from './dto/add-playlist-item.dto';
import { UpdatePlaylistItemDto } from './dto/update-playlist-item.dto';
import { ReorderPlaylistItemsDto } from './dto/reorder-playlist-items.dto';

@ApiTags('playlists')
@ApiBearerAuth('access-token')
@Controller('playlists')
export class PlaylistsController {
  constructor(private readonly playlistsService: PlaylistsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new playlist' })
  @ApiResponse({ status: 201, description: 'Playlist successfully created' })
  create(@Body() createPlaylistDto: CreatePlaylistDto) {
    return this.playlistsService.create(createPlaylistDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all playlists with pagination' })
  @ApiResponse({ status: 200, description: 'List of playlists' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = Math.max(parseInt(page || '1', 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit || '20', 10) || 20, 1), 100);
    return this.playlistsService.findAll(pageNum, limitNum);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get playlist by ID' })
  @ApiResponse({ status: 200, description: 'Playlist details' })
  @ApiResponse({ status: 404, description: 'Playlist not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.playlistsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update playlist' })
  @ApiResponse({ status: 200, description: 'Playlist successfully updated' })
  @ApiResponse({ status: 404, description: 'Playlist not found' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePlaylistDto: UpdatePlaylistDto,
  ) {
    return this.playlistsService.update(id, updatePlaylistDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete playlist',
    description:
      'Deletes a playlist and all its items. If playlist is assigned to devices, ' +
      'use force=true to unassign from all devices first (devices will display default screen).',
  })
  @ApiQuery({
    name: 'force',
    required: false,
    type: Boolean,
    description:
      'If true, unassigns playlist from all devices before deletion. ' +
      'Devices will be set to display the default "Hello World" screen.',
  })
  @ApiResponse({ status: 200, description: 'Playlist successfully deleted' })
  @ApiResponse({ status: 404, description: 'Playlist not found' })
  @ApiResponse({
    status: 400,
    description: 'Playlist is in use by devices (use force=true to unassign and delete)',
  })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Query('force') force: string,
  ) {
    const forceDelete = force === 'true' || force === '1';
    return this.playlistsService.remove(id, forceDelete);
  }

  // Playlist Items Management

  @Post(':id/items')
  @ApiOperation({ summary: 'Add screen to playlist' })
  @ApiResponse({ status: 201, description: 'Screen added to playlist' })
  @ApiResponse({ status: 404, description: 'Playlist or screen not found' })
  @ApiResponse({ status: 400, description: 'Screen already in playlist' })
  addItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() addItemDto: AddPlaylistItemDto,
  ) {
    return this.playlistsService.addItem(id, addItemDto);
  }

  @Patch(':id/items/:itemId')
  @ApiOperation({ summary: 'Update playlist item' })
  @ApiResponse({ status: 200, description: 'Playlist item updated' })
  @ApiResponse({ status: 404, description: 'Playlist or item not found' })
  updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() updateItemDto: UpdatePlaylistItemDto,
  ) {
    return this.playlistsService.updateItem(id, itemId, updateItemDto);
  }

  @Delete(':id/items/:itemId')
  @ApiOperation({ summary: 'Remove screen from playlist' })
  @ApiResponse({ status: 200, description: 'Screen removed from playlist' })
  @ApiResponse({ status: 404, description: 'Playlist or item not found' })
  removeItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.playlistsService.removeItem(id, itemId);
  }

  @Post(':id/reorder')
  @ApiOperation({ summary: 'Reorder playlist items' })
  @ApiResponse({ status: 200, description: 'Playlist items reordered' })
  @ApiResponse({ status: 404, description: 'Playlist not found' })
  reorderItems(
    @Param('id', ParseIntPipe) id: number,
    @Body() reorderDto: ReorderPlaylistItemsDto,
  ) {
    return this.playlistsService.reorderItems(id, reorderDto.items);
  }
}
