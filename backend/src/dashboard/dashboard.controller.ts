import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { DashboardStatsDto } from './dto/dashboard-stats.dto';

/**
 * Dashboard controller
 * Provides endpoints for dashboard statistics and overview data
 *
 * All endpoints require authentication (JWT Bearer token)
 */
@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Get dashboard statistics
   *
   * Returns aggregated statistics including:
   * - Total device count
   * - Online device count (seen in last 5 minutes)
   * - Total screen count
   * - Total playlist count
   * - 5 most recent devices
   * - 4 most recent screens
   *
   * This endpoint is called by the frontend Dashboard component
   * to display overview statistics and recent activity.
   *
   * @returns DashboardStatsDto containing all statistics
   */
  @Get('stats')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get dashboard statistics',
    description: 'Retrieve aggregated statistics and recent items for the dashboard view'
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard statistics successfully retrieved',
    type: DashboardStatsDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error - Database query failed',
  })
  async getStats(): Promise<DashboardStatsDto> {
    return this.dashboardService.getStats();
  }
}
