import {
  Body,
  Controller,
  Get,
  Header,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtAccessPayload } from '../auth/jwt.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { BILLING_WRITE_ROLES } from './billing.constants';
import { ManualLedgerDto } from './dto/manual-ledger.dto';
import { LedgerService } from './ledger.service';

@ApiTags('billing — ledger')
@ApiBearerAuth()
@Controller('billing/ledger')
export class LedgerController {
  constructor(private readonly service: LedgerService) {}

  @Get()
  @ApiOperation({ summary: 'List ledger entries (tenant sub-ledger)' })
  @ApiQuery({ name: 'leaseId', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  findAll(
    @CurrentUser() user: JwtAccessPayload,
    @Query('leaseId', new ParseUUIDPipe({ version: '4', optional: true }))
    leaseId?: string,
    @Query('tenantId', new ParseUUIDPipe({ version: '4', optional: true }))
    tenantId?: string,
  ) {
    return this.service.findAll(user, { leaseId, tenantId });
  }

  @Get('export')
  @ApiOperation({ summary: 'Download ledger as CSV (ERP-friendly)' })
  @ApiProduces('text/csv')
  @ApiQuery({ name: 'leaseId', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  @Header('Content-Disposition', 'attachment; filename="sofinda-ledger.csv"')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(
    @CurrentUser() user: JwtAccessPayload,
    @Query('leaseId', new ParseUUIDPipe({ version: '4', optional: true }))
    leaseId?: string,
    @Query('tenantId', new ParseUUIDPipe({ version: '4', optional: true }))
    tenantId?: string,
  ) {
    return this.service.exportCsv(user, { leaseId, tenantId });
  }

  @Post('manual')
  @UseGuards(RolesGuard)
  @Roles(...BILLING_WRITE_ROLES)
  @ApiOperation({ summary: 'Post manual payment or adjustment (append-only)' })
  createManual(
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: ManualLedgerDto,
  ) {
    return this.service.createManual(user, dto);
  }
}
