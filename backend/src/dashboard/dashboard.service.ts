import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardStatsDto } from './dto/dashboard-stats.dto';

/**
 * Dashboard service
 * Provides aggregated statistics for the dashboard view
 *
 * Per Node.js best practices, this service:
 * - Uses async/await for database operations
 * - Implements proper error handling
 * - Uses structured logging for observability
 * - Optimizes database queries with Prisma
 */
@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get dashboard statistics including counts and recent items
   *
   * This method performs multiple database queries in parallel using Promise.all
   * for optimal performance. Device online status is determined by checking
   * if lastSeenAt is within the last 5 minutes.
   *
   * @returns DashboardStatsDto containing all dashboard statistics
   */
  async getStats(): Promise<DashboardStatsDto> {
    this.logger.log('Fetching dashboard statistics');

    try {
      // Calculate the timestamp for "online" devices (last 5 minutes)
      const onlineThreshold = new Date(Date.now() - 5 * 60 * 1000);

      // Execute all queries in parallel for optimal performance
      const [
        totalDevices,
        onlineDevices,
        totalScreens,
        totalPlaylists,
        recentDevices,
        recentScreens,
      ] = await Promise.all([
        // Count total devices
        this.prisma.device.count(),

        // Count online devices (seen within last 5 minutes)
        this.prisma.device.count({
          where: {
            lastSeenAt: {
              gte: onlineThreshold,
            },
          },
        }),

        // Count total screen designs
        this.prisma.screenDesign.count(),

        // Count total playlists
        this.prisma.playlist.count(),

        // Get 5 most recent devices with relevant fields
        this.prisma.device.findMany({
          take: 5,
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            name: true,
            macAddress: true,
            lastSeenAt: true,
            createdAt: true,
            battery: true,
            wifi: true,
          },
        }),

        // Get 4 most recent screen designs with relevant fields
        this.prisma.screenDesign.findMany({
          take: 4,
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            name: true,
            description: true,
            createdAt: true,
          },
        }),
      ]);

      // Map devices to include computed status field
      const mappedDevices = recentDevices.map(device => ({
        ...device,
        status: this.getDeviceStatus(device.lastSeenAt, onlineThreshold),
      }));

      const stats: DashboardStatsDto = {
        totalDevices,
        onlineDevices,
        totalScreens,
        totalPlaylists,
        recentDevices: mappedDevices,
        recentScreens,
      };

      this.logger.log(
        `Dashboard stats retrieved: ${totalDevices} devices (${onlineDevices} online), ` +
        `${totalScreens} screens, ${totalPlaylists} playlists`
      );

      return stats;
    } catch (error) {
      this.logger.error('Failed to fetch dashboard statistics', error);
      throw error;
    }
  }

  /**
   * Determine device status based on lastSeenAt timestamp
   *
   * @param lastSeenAt - Last time device was seen
   * @param onlineThreshold - Threshold date for considering device online
   * @returns 'online' or 'offline'
   */
  private getDeviceStatus(
    lastSeenAt: Date | null,
    onlineThreshold: Date
  ): 'online' | 'offline' {
    if (!lastSeenAt) {
      return 'offline';
    }
    return lastSeenAt >= onlineThreshold ? 'online' : 'offline';
  }
}
