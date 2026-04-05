import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BuildingsController } from './buildings.controller';
import { BuildingsService } from './buildings.service';
import { FloorsController } from './floors.controller';
import { FloorsService } from './floors.service';
import { PortfoliosController } from './portfolios.controller';
import { PortfoliosService } from './portfolios.service';
import { UnitsController } from './units.controller';
import { UnitsService } from './units.service';

@Module({
  imports: [AuthModule],
  controllers: [
    PortfoliosController,
    BuildingsController,
    FloorsController,
    UnitsController,
  ],
  providers: [PortfoliosService, BuildingsService, FloorsService, UnitsService],
})
export class PropertyModule {}
