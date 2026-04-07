import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtAccessPayload } from '../auth/jwt.types';
import { DashboardService } from './dashboard.service';

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
}
