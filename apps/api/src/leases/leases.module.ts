import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LeasesController } from './leases.controller';
import { LeasesService } from './leases.service';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  imports: [AuthModule],
  controllers: [TenantsController, LeasesController],
  providers: [TenantsService, LeasesService],
})
export class LeasesModule {}
