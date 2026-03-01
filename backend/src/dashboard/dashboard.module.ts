import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Dashboard module
 * Provides dashboard statistics and overview functionality
 *
 * This module:
 * - Imports PrismaModule for database access
 * - Exports DashboardService for potential use in other modules
 * - Registers DashboardController for the /dashboard routes
 */
@Module({
  imports: [PrismaModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
