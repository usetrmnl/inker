import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { AddPlaylistItemDto } from './dto/add-playlist-item.dto';
import { UpdatePlaylistItemDto } from './dto/update-playlist-item.dto';
import { wrapPaginatedResponse } from '../common/utils/response.util';
import { EventsService } from '../events/events.service';

@Injectable()
export class PlaylistsService {
  private readonly logger = new Logger(PlaylistsService.name);

  constructor(
    private prisma: PrismaService,
    private eventsService: EventsService,
  ) {}

  /**
   * Create a new playlist
   */
  async create(createPlaylistDto: CreatePlaylistDto) {
    const { screens, ...playlistData } = createPlaylistDto;

    const playlist = await this.prisma.playlist.create({
      data: {
        name: playlistData.name,
        description: playlistData.description,
        isActive: playlistData.isActive ?? true,
      },
      include: {
        items: {
          include: {
            screen: true,
            screenDesign: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    // Handle screens if provided
    if (screens && screens.length > 0) {
      // Parse and categorize screen IDs to avoid N+1 queries
      const designIds: number[] = [];
      const regularIds: number[] = [];
      const screenMap = new Map<string, { type: 'design' | 'regular'; id: number; order: number; duration: number }>();

      screens.forEach((screenData, i) => {
        if (typeof screenData.screenId === 'string' && screenData.screenId.startsWith('design-')) {
          const designId = parseInt(screenData.screenId.replace('design-', ''), 10);
          if (!isNaN(designId)) {
            designIds.push(designId);
            screenMap.set(screenData.screenId, {
              type: 'design',
              id: designId,
              order: screenData.order ?? i,
              duration: screenData.duration ?? 60,
            });
          } else {
            this.logger.warn(`Invalid screen design ID: ${screenData.screenId}`);
          }
        } else {
          const screenId = typeof screenData.screenId === 'string'
            ? parseInt(screenData.screenId, 10)
            : screenData.screenId as unknown as number;
          if (!isNaN(screenId)) {
            regularIds.push(screenId);
            screenMap.set(String(screenId), {
              type: 'regular',
              id: screenId,
              order: screenData.order ?? i,
              duration: screenData.duration ?? 60,
            });
          } else {
            this.logger.warn(`Invalid screenId: ${screenData.screenId}`);
          }
        }
      });

      // Batch verify existence of all screens/designs
      const [existingDesigns, existingScreens] = await Promise.all([
        designIds.length > 0
          ? this.prisma.screenDesign.findMany({ where: { id: { in: designIds } }, select: { id: true } })
          : Promise.resolve([]),
        regularIds.length > 0
          ? this.prisma.screen.findMany({ where: { id: { in: regularIds } }, select: { id: true } })
          : Promise.resolve([]),
      ]);

      const existingDesignIds = new Set(existingDesigns.map((d) => d.id));
      const existingScreenIds = new Set(existingScreens.map((s) => s.id));

      // Build playlist items in a single transaction
      const itemsToCreate = screens
        .map((screenData, i) => {
          const key = typeof screenData.screenId === 'string' && screenData.screenId.startsWith('design-')
            ? screenData.screenId
            : String(typeof screenData.screenId === 'string' ? parseInt(screenData.screenId, 10) : screenData.screenId);
          const mapped = screenMap.get(key);
          if (!mapped) return null;

          if (mapped.type === 'design') {
            if (!existingDesignIds.has(mapped.id)) {
              this.logger.warn(`Screen design not found: ${mapped.id}`);
              return null;
            }
            return {
              playlistId: playlist.id,
              screenDesignId: mapped.id,
              order: mapped.order,
              duration: mapped.duration,
            };
          } else {
            if (!existingScreenIds.has(mapped.id)) {
              this.logger.warn(`Screen not found: ${mapped.id}`);
              return null;
            }
            return {
              playlistId: playlist.id,
              screenId: mapped.id,
              order: mapped.order,
              duration: mapped.duration,
            };
          }
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      if (itemsToCreate.length > 0) {
        await this.prisma.playlistItem.createMany({ data: itemsToCreate });
      }

      // Refetch playlist with items
      const updatedPlaylist = await this.prisma.playlist.findUnique({
        where: { id: playlist.id },
        include: {
          items: {
            include: {
              screen: true,
              screenDesign: true,
            },
            orderBy: {
              order: 'asc',
            },
          },
        },
      });

      this.logger.log(`Playlist created: ${playlist.name} with ${itemsToCreate.length} screens`);

      return updatedPlaylist;
    }

    this.logger.log(`Playlist created: ${playlist.name}`);

    return playlist;
  }

  /**
   * Find all playlists with pagination
   */
  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [playlists, total] = await Promise.all([
      this.prisma.playlist.findMany({
        include: {
          _count: {
            select: {
              items: true,
              devices: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.playlist.count(),
    ]);

    return wrapPaginatedResponse(playlists, total, page, limit);
  }

  /**
   * Find one playlist by ID
   */
  async findOne(id: number) {
    const playlist = await this.prisma.playlist.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            screen: {
              include: {
                model: true,
              },
            },
            screenDesign: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
        devices: {
          select: {
            id: true,
            name: true,
            macAddress: true,
            width: true,
            height: true,
          },
        },
      },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    // Transform items to screens array for frontend compatibility
    const screens = playlist.items.map((item) => {
      if (item.screenDesign) {
        // Generate preview URL for designed screens (preview=true skips e-ink processing)
        const previewUrl = `/api/device-images/design/${item.screenDesign.id}?preview=true`;
        return {
          id: `design-${item.screenDesign.id}`,
          screenId: `design-${item.screenDesign.id}`,
          name: item.screenDesign.name,
          description: item.screenDesign.description,
          thumbnailUrl: previewUrl,
          imageUrl: previewUrl,
          duration: item.duration,
          order: item.order,
          isDesigned: true,
        };
      } else if (item.screen) {
        return {
          id: item.screen.id,
          screenId: String(item.screen.id),
          name: item.screen.name,
          description: item.screen.description,
          thumbnailUrl: item.screen.thumbnailUrl,
          imageUrl: item.screen.imageUrl,
          duration: item.duration,
          order: item.order,
          isDesigned: false,
        };
      }
      return null;
    }).filter(Boolean);

    return {
      ...playlist,
      screens,
    };
  }

  /**
   * Update playlist
   */
  async update(id: number, updatePlaylistDto: UpdatePlaylistDto) {
    const playlist = await this.prisma.playlist.findUnique({
      where: { id },
      include: {
        _count: {
          select: { devices: true },
        },
      },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    // Prevent deactivating a playlist that has devices assigned
    if (updatePlaylistDto.isActive === false && playlist._count.devices > 0) {
      throw new BadRequestException(
        `Cannot deactivate playlist - it is assigned to ${playlist._count.devices} device(s). Unassign all devices first.`,
      );
    }

    // Extract screens for separate handling
    const { screens, ...playlistData } = updatePlaylistDto;

    // Update playlist basic data
    const updatedPlaylist = await this.prisma.playlist.update({
      where: { id },
      data: {
        name: playlistData.name,
        description: playlistData.description,
        isActive: playlistData.isActive,
      },
      include: {
        items: {
          include: {
            screen: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    // Handle screens update if provided
    if (screens !== undefined) {
      // Delete all existing items
      await this.prisma.playlistItem.deleteMany({
        where: { playlistId: id },
      });

      // Add new items using batch approach to avoid N+1 queries
      if (screens.length > 0) {
        // Parse and categorize screen IDs
        const designIds: number[] = [];
        const regularIds: number[] = [];
        const screenMap = new Map<string, { type: 'design' | 'regular'; id: number; order: number; duration: number }>();

        screens.forEach((screenData, i) => {
          if (typeof screenData.screenId === 'string' && screenData.screenId.startsWith('design-')) {
            const designId = parseInt(screenData.screenId.replace('design-', ''), 10);
            if (!isNaN(designId)) {
              designIds.push(designId);
              screenMap.set(screenData.screenId, {
                type: 'design',
                id: designId,
                order: screenData.order ?? i,
                duration: screenData.duration ?? 60,
              });
            } else {
              this.logger.warn(`Invalid screen design ID: ${screenData.screenId}`);
            }
          } else {
            const screenId = typeof screenData.screenId === 'string'
              ? parseInt(screenData.screenId, 10)
              : screenData.screenId as unknown as number;
            if (!isNaN(screenId)) {
              regularIds.push(screenId);
              screenMap.set(String(screenId), {
                type: 'regular',
                id: screenId,
                order: screenData.order ?? i,
                duration: screenData.duration ?? 60,
              });
            } else {
              this.logger.warn(`Invalid screenId: ${screenData.screenId}`);
            }
          }
        });

        // Batch verify existence of all screens/designs
        const [existingDesigns, existingScreens] = await Promise.all([
          designIds.length > 0
            ? this.prisma.screenDesign.findMany({ where: { id: { in: designIds } }, select: { id: true } })
            : Promise.resolve([]),
          regularIds.length > 0
            ? this.prisma.screen.findMany({ where: { id: { in: regularIds } }, select: { id: true } })
            : Promise.resolve([]),
        ]);

        const existingDesignIds = new Set(existingDesigns.map((d) => d.id));
        const existingScreenIds = new Set(existingScreens.map((s) => s.id));

        // Build playlist items in a single batch
        const itemsToCreate = screens
          .map((screenData, i) => {
            const key = typeof screenData.screenId === 'string' && screenData.screenId.startsWith('design-')
              ? screenData.screenId
              : String(typeof screenData.screenId === 'string' ? parseInt(screenData.screenId, 10) : screenData.screenId);
            const mapped = screenMap.get(key);
            if (!mapped) return null;

            if (mapped.type === 'design') {
              if (!existingDesignIds.has(mapped.id)) {
                this.logger.warn(`Screen design not found: ${mapped.id}`);
                return null;
              }
              return {
                playlistId: id,
                screenDesignId: mapped.id,
                order: mapped.order,
                duration: mapped.duration,
              };
            } else {
              if (!existingScreenIds.has(mapped.id)) {
                this.logger.warn(`Screen not found: ${mapped.id}`);
                return null;
              }
              return {
                playlistId: id,
                screenId: mapped.id,
                order: mapped.order,
                duration: mapped.duration,
              };
            }
          })
          .filter((item): item is NonNullable<typeof item> => item !== null);

        if (itemsToCreate.length > 0) {
          await this.prisma.playlistItem.createMany({ data: itemsToCreate });
        }
      }

      // Refetch playlist with updated items and transform to screens array
      const updatedPlaylistWithItems = await this.prisma.playlist.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              screen: true,
              screenDesign: true,
            },
            orderBy: {
              order: 'asc',
            },
          },
        },
      });

      if (!updatedPlaylistWithItems) {
        throw new NotFoundException('Playlist not found after update');
      }

      // Transform items to screens array
      const transformedScreens = updatedPlaylistWithItems.items.map((item) => {
        if (item.screenDesign) {
          // Generate preview URL for designed screens (preview=true skips e-ink processing)
          const previewUrl = `/api/device-images/design/${item.screenDesign.id}?preview=true`;
          return {
            id: `design-${item.screenDesign.id}`,
            screenId: `design-${item.screenDesign.id}`,
            name: item.screenDesign.name,
            description: item.screenDesign.description,
            thumbnailUrl: previewUrl,
            imageUrl: previewUrl,
            duration: item.duration,
            order: item.order,
            isDesigned: true,
          };
        } else if (item.screen) {
          return {
            id: item.screen.id,
            screenId: String(item.screen.id),
            name: item.screen.name,
            description: item.screen.description,
            thumbnailUrl: item.screen.thumbnailUrl,
            imageUrl: item.screen.imageUrl,
            duration: item.duration,
            order: item.order,
            isDesigned: false,
          };
        }
        return null;
      }).filter(Boolean);

      // Notify devices that use this playlist to refresh
      await this.eventsService.notifyPlaylistUpdate(id);

      return {
        ...updatedPlaylistWithItems,
        screens: transformedScreens,
      };
    }

    this.logger.log(`Playlist updated: ${updatedPlaylist.name}`);

    // Notify devices that use this playlist to refresh
    await this.eventsService.notifyPlaylistUpdate(id);

    return updatedPlaylist;
  }

  /**
   * Delete playlist
   * @param force - If true, unassign all devices first and then delete
   */
  async remove(id: number, force = false) {
    const playlist = await this.prisma.playlist.findUnique({
      where: { id },
      include: {
        devices: {
          select: { id: true },
        },
        _count: {
          select: {
            devices: true,
          },
        },
      },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    // Check if playlist is in use
    if (playlist._count.devices > 0) {
      if (force) {
        // Unassign all devices first
        const deviceIds = playlist.devices.map((d) => d.id);
        await this.prisma.device.updateMany({
          where: { playlistId: id },
          data: {
            playlistId: null,
            refreshPending: true, // Trigger refresh to show default screen
          },
        });
        this.logger.log(
          `Force delete: Unassigned ${deviceIds.length} device(s) from playlist ${playlist.name}`,
        );

        // Notify devices to refresh
        await this.eventsService.notifyDevicesRefresh(deviceIds);
      } else {
        throw new BadRequestException(
          `Cannot delete playlist - it is assigned to ${playlist._count.devices} device(s). Use force=true to unassign devices and delete.`,
        );
      }
    }

    await this.prisma.playlist.delete({
      where: { id },
    });

    this.logger.log(`Playlist deleted: ${playlist.name}`);

    return {
      message: 'Playlist deleted successfully',
      unassignedDevices: force ? playlist._count.devices : 0,
    };
  }

  /**
   * Add item to playlist
   */
  async addItem(playlistId: number, addItemDto: AddPlaylistItemDto) {
    const playlist = await this.prisma.playlist.findUnique({
      where: { id: playlistId },
      include: {
        items: true,
      },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    // Check if screen exists
    const screen = await this.prisma.screen.findUnique({
      where: { id: addItemDto.screenId },
    });

    if (!screen) {
      throw new NotFoundException('Screen not found');
    }

    // Check if item already exists in playlist
    const existingItem = await this.prisma.playlistItem.findFirst({
      where: {
        playlistId,
        screenId: addItemDto.screenId,
      },
    });

    if (existingItem) {
      throw new BadRequestException('Screen already in playlist');
    }

    // Determine order (append to end if not specified)
    const order =
      addItemDto.order !== undefined
        ? addItemDto.order
        : playlist.items.length;

    // Create playlist item
    const item = await this.prisma.playlistItem.create({
      data: {
        playlistId,
        screenId: addItemDto.screenId,
        order,
        duration: addItemDto.duration || 60,
      },
      include: {
        screen: {
          include: {
            model: true,
          },
        },
      },
    });

    this.logger.log(
      `Screen ${screen.name} added to playlist ${playlist.name}`,
    );

    // Notify devices that use this playlist to refresh
    await this.eventsService.notifyPlaylistUpdate(playlistId);

    return item;
  }

  /**
   * Update playlist item
   */
  async updateItem(
    playlistId: number,
    itemId: number,
    updateItemDto: UpdatePlaylistItemDto,
  ) {
    const playlist = await this.prisma.playlist.findUnique({
      where: { id: playlistId },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    // Check if item exists
    const item = await this.prisma.playlistItem.findUnique({
      where: { id: itemId },
    });

    if (!item || item.playlistId !== playlistId) {
      throw new NotFoundException('Playlist item not found');
    }

    // Update item
    const updatedItem = await this.prisma.playlistItem.update({
      where: { id: itemId },
      data: {
        order: updateItemDto.order,
        duration: updateItemDto.duration,
      },
      include: {
        screen: {
          include: {
            model: true,
          },
        },
      },
    });

    this.logger.log(`Playlist item ${itemId} updated`);

    // Notify devices that use this playlist to refresh
    await this.eventsService.notifyPlaylistUpdate(playlistId);

    return updatedItem;
  }

  /**
   * Remove item from playlist
   */
  async removeItem(playlistId: number, itemId: number) {
    const playlist = await this.prisma.playlist.findUnique({
      where: { id: playlistId },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    // Check if item exists
    const item = await this.prisma.playlistItem.findUnique({
      where: { id: itemId },
    });

    if (!item || item.playlistId !== playlistId) {
      throw new NotFoundException('Playlist item not found');
    }

    // Delete item
    await this.prisma.playlistItem.delete({
      where: { id: itemId },
    });

    this.logger.log(`Playlist item ${itemId} removed from playlist ${playlistId}`);

    // Notify devices that use this playlist to refresh
    await this.eventsService.notifyPlaylistUpdate(playlistId);

    return { message: 'Playlist item removed successfully' };
  }

  /**
   * Reorder playlist items
   */
  async reorderItems(
    playlistId: number,
    itemOrders: { id: number; order: number }[],
  ) {
    const playlist = await this.prisma.playlist.findUnique({
      where: { id: playlistId },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    // Update orders in transaction
    await this.prisma.$transaction(
      itemOrders.map(({ id, order }) =>
        this.prisma.playlistItem.update({
          where: { id },
          data: { order },
        }),
      ),
    );

    this.logger.log(`Playlist ${playlistId} items reordered`);

    // Notify devices that use this playlist to refresh
    await this.eventsService.notifyPlaylistUpdate(playlistId);

    return { message: 'Playlist items reordered successfully' };
  }
}
