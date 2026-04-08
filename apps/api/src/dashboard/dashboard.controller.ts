import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtAccessPayload } from '../auth/jwt.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { LEASE_WRITE_ROLES } from '../leases/lease.constants';
import { DashboardService } from './dashboard.service';

const PERFORMANCE_VIEW_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ORG_ADMIN,
  UserRole.FINANCE,
  UserRole.PORTFOLIO_MANAGER,
] as const;

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('metrics')
  @ApiOperation({
    summary: 'Scoped counts for home dashboard (RLS / org isolation)',
  })
  @ApiOkResponse({
    description: 'Totals for leases, tenants, invoices, ledger lines',
  })
  metrics(@CurrentUser() user: JwtAccessPayload) {
    return this.dashboardService.metrics(user);
  }

  @Get('profile-metrics')
  @ApiOperation({
    summary:
      'Logged-in user profile performance metrics (tenant honesty + recovery)',
  })
  @ApiOkResponse({
    description:
      'Profile details and scoped performance KPIs for collection tracking',
  })
  profileMetrics(@CurrentUser() user: JwtAccessPayload) {
    return this.dashboardService.profileMetrics(user);
  }

  @Get('org-staff')
  @UseGuards(RolesGuard)
  @Roles(...LEASE_WRITE_ROLES)
  @ApiOperation({
    summary:
      'Staff users in an organization (for lease broker picker). SUPER_ADMIN may pass organizationId.',
  })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiOkResponse({ description: 'organizationId and users (excludes tenant portal roles)' })
  orgStaff(
    @CurrentUser() user: JwtAccessPayload,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.dashboardService.orgStaff(user, organizationId);
  }

  @Get('performance')
  @UseGuards(RolesGuard)
  @Roles(...PERFORMANCE_VIEW_ROLES)
  @ApiOperation({
    summary:
      'Org-wide tenant performance leaderboard (honesty + recovery, executive roles)',
  })
  @ApiOkResponse({
    description: 'Per-tenant KPIs and rankings scoped by RLS / organization',
  })
  performance(@CurrentUser() user: JwtAccessPayload) {
    return this.dashboardService.performance(user);
  }
}
