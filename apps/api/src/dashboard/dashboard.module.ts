import { Module } from '@nestjs/common';
import { PortalModule } from '../portal/portal.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [PortalModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
