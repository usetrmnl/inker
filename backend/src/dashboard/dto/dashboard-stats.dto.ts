import { ApiProperty } from '@nestjs/swagger';

/**
 * Device data for recent devices list
 */
class RecentDeviceDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Living Room Device' })
  name: string;

  @ApiProperty({ example: '00:11:22:33:44:55' })
  macAddress: string;

  @ApiProperty({ example: 'online', enum: ['online', 'offline'] })
  status: string;

  @ApiProperty({ example: '2025-12-06T10:30:00Z' })
  lastSeenAt: Date | null;

  @ApiProperty({ example: '2025-12-06T09:00:00Z' })
  createdAt: Date;
}

/**
 * Screen data for recent screens list
 */
class RecentScreenDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Welcome Screen' })
  name: string;

  @ApiProperty({ example: 'Welcome screen description', nullable: true })
  description: string | null;

  @ApiProperty({ example: '2025-12-06T09:00:00Z' })
  createdAt: Date;
}

/**
 * Dashboard statistics response DTO
 * Matches the frontend DashboardStats interface
 */
export class DashboardStatsDto {
  @ApiProperty({
    description: 'Total number of devices in the system',
    example: 15
  })
  totalDevices: number;

  @ApiProperty({
    description: 'Number of devices currently online (seen in last 5 minutes)',
    example: 12
  })
  onlineDevices: number;

  @ApiProperty({
    description: 'Total number of screens in the system',
    example: 25
  })
  totalScreens: number;

  @ApiProperty({
    description: 'Total number of playlists in the system',
    example: 8
  })
  totalPlaylists: number;

  @ApiProperty({
    description: 'Most recently created devices (up to 5)',
    type: [RecentDeviceDto]
  })
  recentDevices: RecentDeviceDto[];

  @ApiProperty({
    description: 'Most recently created screens (up to 4)',
    type: [RecentScreenDto]
  })
  recentScreens: RecentScreenDto[];
}
