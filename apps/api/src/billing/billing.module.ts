import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChargeSchedulesController } from './charge-schedules.controller';
import { ChargeSchedulesService } from './charge-schedules.service';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { LedgerController } from './ledger.controller';
import { LedgerService } from './ledger.service';

@Module({
  imports: [AuthModule],
  controllers: [
    ChargeSchedulesController,
    InvoicesController,
    LedgerController,
  ],
  providers: [ChargeSchedulesService, InvoicesService, LedgerService],
})
export class BillingModule {}
