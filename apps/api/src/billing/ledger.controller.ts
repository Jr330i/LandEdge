import { LedgerSource } from '@prisma/client';
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
import { CONSOLE_ACCESS_ROLES } from '../auth/role-matrix.constants';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { BILLING_WRITE_ROLES } from './billing.constants';
import { ManualLedgerDto } from './dto/manual-ledger.dto';
import { LedgerService } from './ledger.service';

@ApiTags('billing — ledger')
@ApiBearerAuth()
@Controller('billing/ledger')
@UseGuards(RolesGuard)
@Roles(...CONSOLE_ACCESS_ROLES)
export class LedgerController {
  constructor(private readonly service: LedgerService) {}

  @Get()
  @ApiOperation({ summary: 'List ledger entries (tenant sub-ledger)' })
  @ApiQuery({ name: 'leaseId', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'source', required: false, enum: LedgerSource })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'createdFrom', required: false })
  @ApiQuery({ name: 'createdTo', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  findAll(
    @CurrentUser() user: JwtAccessPayload,
    @Query('leaseId', new ParseUUIDPipe({ version: '4', optional: true }))
    leaseId?: string,
    @Query('tenantId', new ParseUUIDPipe({ version: '4', optional: true }))
    tenantId?: string,
    @Query('source') sourceRaw?: string,
    @Query('q') q?: string,
    @Query('createdFrom') createdFrom?: string,
    @Query('createdTo') createdTo?: string,
    @Query('page') pageRaw?: string,
    @Query('pageSize') pageSizeRaw?: string,
  ) {
    const source =
      sourceRaw &&
      Object.values(LedgerSource).includes(sourceRaw as LedgerSource)
        ? (sourceRaw as LedgerSource)
        : undefined;
    const page = pageRaw ? Number.parseInt(pageRaw, 10) : undefined;
    const pageSize = pageSizeRaw ? Number.parseInt(pageSizeRaw, 10) : undefined;
    return this.service.findAll(user, {
      leaseId,
      tenantId,
      source,
      q,
      createdFrom,
      createdTo,
      page: Number.isFinite(page) ? page : undefined,
      pageSize: Number.isFinite(pageSize) ? pageSize : undefined,
    });
  }

  @Get('export')
  @ApiOperation({ summary: 'Download ledger as CSV (ERP-friendly)' })
  @ApiProduces('text/csv')
  @ApiQuery({ name: 'leaseId', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'source', required: false, enum: LedgerSource })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'createdFrom', required: false })
  @ApiQuery({ name: 'createdTo', required: false })
  @Header('Content-Disposition', 'attachment; filename="sofinda-ledger.csv"')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(
    @CurrentUser() user: JwtAccessPayload,
    @Query('leaseId', new ParseUUIDPipe({ version: '4', optional: true }))
    leaseId?: string,
    @Query('tenantId', new ParseUUIDPipe({ version: '4', optional: true }))
    tenantId?: string,
    @Query('source') sourceRaw?: string,
    @Query('q') q?: string,
    @Query('createdFrom') createdFrom?: string,
    @Query('createdTo') createdTo?: string,
  ) {
    const source =
      sourceRaw &&
      Object.values(LedgerSource).includes(sourceRaw as LedgerSource)
        ? (sourceRaw as LedgerSource)
        : undefined;
    return this.service.exportCsv(user, {
      leaseId,
      tenantId,
      source,
      q,
      createdFrom,
      createdTo,
    });
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
