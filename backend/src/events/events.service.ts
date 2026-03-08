import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Subject, Observable, filter } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

export type DeviceEventType =
  | 'screen:updated'
  | 'screen:deleted'
  | 'playlist:updated'
  | 'playlist:deleted'
  | 'screen_design:updated'
  | 'screen_design:deleted'
  | 'device:refresh';

export interface DeviceEvent {
  type: DeviceEventType;
  payload: {
    id?: number;
    deviceIds?: number[];
    playlistId?: number;
    screenId?: number;
    screenDesignId?: number;
    timestamp: number;
  };
}

@Injectable()
export class EventsService implements OnModuleDestroy {
  private readonly logger = new Logger(EventsService.name);
  private events$ = new Subject<DeviceEvent>();

  constructor(private prisma: PrismaService) {}

  /**
   * Cleanup the Subject when the module is destroyed to prevent memory leaks
   */
  onModuleDestroy() {
    this.events$.complete();
  }

  /**
   * Emit an event to all connected clients
   */
  emit(event: DeviceEvent): void {
    this.logger.debug(`Emitting event: ${event.type}`, event.payload);
    this.events$.next(event);
  }

  /**
   * Get observable stream of events
   */
  getEventStream(): Observable<DeviceEvent> {
    return this.events$.asObservable();
  }

  /**
   * Get events filtered for specific device IDs
   */
  getEventsForDevices(deviceIds: number[]): Observable<DeviceEvent> {
    return this.events$.pipe(
      filter((event) => {
        // If event has specific deviceIds, check if any match
        if (event.payload.deviceIds && event.payload.deviceIds.length > 0) {
          return event.payload.deviceIds.some((id) => deviceIds.includes(id));
        }
        // Otherwise, pass all events (client will filter based on their playlists/screens)
        return true;
      }),
    );
  }

  /**
   * Notify devices when a screen is updated
   * Finds all devices that have this screen in their playlist
   */
  async notifyScreenUpdate(screenId: number): Promise<void> {
    // Find all playlists containing this screen
    const playlistItems = await this.prisma.playlistItem.findMany({
      where: { screenId },
      include: {
        playlist: {
          include: {
            devices: {
              select: { id: true },
            },
          },
        },
      },
    });

    // Collect all device IDs that need to be notified
    const deviceIds = new Set<number>();
    for (const item of playlistItems) {
      for (const device of item.playlist.devices) {
        deviceIds.add(device.id);
      }
    }

    const deviceIdsArray = Array.from(deviceIds);

    if (deviceIdsArray.length > 0) {
      // Set refreshPending flag on all affected devices
      await this.prisma.device.updateMany({
        where: { id: { in: deviceIdsArray } },
        data: { refreshPending: true },
      });

      this.logger.log(
        `Screen ${screenId} updated - notifying ${deviceIdsArray.length} devices`,
      );
    }

    this.emit({
      type: 'screen:updated',
      payload: {
        screenId,
        deviceIds: deviceIdsArray,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Notify devices when a playlist is updated
   */
  async notifyPlaylistUpdate(playlistId: number): Promise<void> {
    // Find all devices using this playlist
    const devices = await this.prisma.device.findMany({
      where: { playlistId },
      select: { id: true },
    });

    const deviceIds = devices.map((d) => d.id);

    if (deviceIds.length > 0) {
      // Set refreshPending flag on all affected devices
      await this.prisma.device.updateMany({
        where: { id: { in: deviceIds } },
        data: { refreshPending: true },
      });

      this.logger.log(
        `Playlist ${playlistId} updated - notifying ${deviceIds.length} devices`,
      );
    }

    this.emit({
      type: 'playlist:updated',
      payload: {
        playlistId,
        deviceIds,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Notify devices when a screen design is updated
   * @returns The number of devices that were notified
   */
  async notifyScreenDesignUpdate(screenDesignId: number): Promise<number> {
    // Find all playlists containing this screen design
    const playlistItems = await this.prisma.playlistItem.findMany({
      where: { screenDesignId },
      include: {
        playlist: {
          include: {
            devices: {
              select: { id: true },
            },
          },
        },
      },
    });

    // Collect all device IDs
    const deviceIds = new Set<number>();
    for (const item of playlistItems) {
      for (const device of item.playlist.devices) {
        deviceIds.add(device.id);
      }
    }

    // Also find devices with direct screen design assignments
    const directAssignments = await this.prisma.deviceScreenAssignment.findMany({
      where: { screenDesignId },
      select: { deviceId: true },
    });

    for (const assignment of directAssignments) {
      deviceIds.add(assignment.deviceId);
    }

    const deviceIdsArray = Array.from(deviceIds);

    if (deviceIdsArray.length > 0) {
      // Set refreshPending flag on all affected devices
      await this.prisma.device.updateMany({
        where: { id: { in: deviceIdsArray } },
        data: { refreshPending: true },
      });

      this.logger.log(
        `Screen design ${screenDesignId} updated - notifying ${deviceIdsArray.length} devices`,
      );

      // Also emit device:refresh event (same as individual device refresh button)
      // This ensures the frontend dashboard updates and the behavior is consistent
      this.emit({
        type: 'device:refresh',
        payload: {
          deviceIds: deviceIdsArray,
          timestamp: Date.now(),
        },
      });
    }

    this.emit({
      type: 'screen_design:updated',
      payload: {
        screenDesignId,
        deviceIds: deviceIdsArray,
        timestamp: Date.now(),
      },
    });

    return deviceIdsArray.length;
  }

  /**
   * Notify specific devices to refresh
   */
  async notifyDevicesRefresh(deviceIds: number[]): Promise<void> {
    if (deviceIds.length > 0) {
      // Set refreshPending flag on specified devices
      await this.prisma.device.updateMany({
        where: { id: { in: deviceIds } },
        data: { refreshPending: true },
      });

      this.logger.log(`Notifying ${deviceIds.length} devices to refresh`);
    }

    this.emit({
      type: 'device:refresh',
      payload: {
        deviceIds,
        timestamp: Date.now(),
      },
    });
  }
}
