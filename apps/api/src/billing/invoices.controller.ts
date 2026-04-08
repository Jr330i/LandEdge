import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
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
import { AllocateInvoicePaymentDto } from './dto/allocate-invoice-payment.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { GenerateInvoiceFromSchedulesDto } from './dto/generate-invoice-from-schedules.dto';
import { ReverseInvoicePaymentDto } from './dto/reverse-invoice-payment.dto';
import { SendInvoiceEmailDto } from './dto/send-invoice-email.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoicesService } from './invoices.service';

@ApiTags('billing — invoices')
@ApiBearerAuth()
@Controller('billing/invoices')
export class InvoicesController {
  constructor(private readonly service: InvoicesService) {}

  @Get()
  @ApiOperation({ summary: 'List invoices' })
  @ApiQuery({ name: 'leaseId', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: InvoiceStatus })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'periodFrom', required: false })
  @ApiQuery({ name: 'periodTo', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  findAll(
    @CurrentUser() user: JwtAccessPayload,
    @Query('leaseId', new ParseUUIDPipe({ version: '4', optional: true }))
    leaseId?: string,
    @Query('tenantId', new ParseUUIDPipe({ version: '4', optional: true }))
    tenantId?: string,
    @Query('status') statusRaw?: string,
    @Query('q') q?: string,
    @Query('periodFrom') periodFrom?: string,
    @Query('periodTo') periodTo?: string,
    @Query('page') pageRaw?: string,
    @Query('pageSize') pageSizeRaw?: string,
  ) {
    const status =
      statusRaw &&
      Object.values(InvoiceStatus).includes(statusRaw as InvoiceStatus)
        ? (statusRaw as InvoiceStatus)
        : undefined;
    const page = pageRaw ? Number.parseInt(pageRaw, 10) : undefined;
    const pageSize = pageSizeRaw ? Number.parseInt(pageSizeRaw, 10) : undefined;
    return this.service.findAll(user, {
      leaseId,
      tenantId,
      status,
      q,
      periodFrom,
      periodTo,
      page: Number.isFinite(page) ? page : undefined,
      pageSize: Number.isFinite(pageSize) ? pageSize : undefined,
    });
  }

  @Get('export')
  @ApiOperation({ summary: 'Download invoices as CSV (line-level rows, same filters as list)' })
  @ApiProduces('text/csv')
  @ApiQuery({ name: 'leaseId', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: InvoiceStatus })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'periodFrom', required: false })
  @ApiQuery({ name: 'periodTo', required: false })
  @Header('Content-Disposition', 'attachment; filename="sofinda-invoices.csv"')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(
    @CurrentUser() user: JwtAccessPayload,
    @Query('leaseId', new ParseUUIDPipe({ version: '4', optional: true }))
    leaseId?: string,
    @Query('tenantId', new ParseUUIDPipe({ version: '4', optional: true }))
    tenantId?: string,
    @Query('status') statusRaw?: string,
    @Query('q') q?: string,
    @Query('periodFrom') periodFrom?: string,
    @Query('periodTo') periodTo?: string,
  ) {
    const status =
      statusRaw &&
      Object.values(InvoiceStatus).includes(statusRaw as InvoiceStatus)
        ? (statusRaw as InvoiceStatus)
        : undefined;
    return this.service.exportCsv(user, {
      leaseId,
      tenantId,
      status,
      q,
      periodFrom,
      periodTo,
    });
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Download invoice as PDF' })
  @ApiProduces('application/pdf')
  async pdf(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtAccessPayload,
  ): Promise<StreamableFile> {
    const buffer = await this.service.buildPdf(id, user);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="sofinda-invoice-${id.slice(0, 8)}.pdf"`,
    });
  }

  @Get(':id/payments')
  @ApiOperation({
    summary:
      'List payment allocations recorded for this invoice (PAYMENT ledger lines tagged with invoice id)',
  })
  payments(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtAccessPayload,
  ) {
    return this.service.listPayments(id, user);
  }

  @Get(':id/activity')
  @ApiOperation({
    summary: 'Invoice + ledger activity timeline (audit feed)',
  })
  activity(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtAccessPayload,
  ) {
    return this.service.activity(id, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice by id' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtAccessPayload,
  ) {
    return this.service.findOne(id, user);
  }

  @Post('generate-from-schedules')
  @UseGuards(RolesGuard)
  @Roles(...BILLING_WRITE_ROLES)
  @ApiOperation({
    summary:
      'Create draft invoice from active charge schedules (idempotent draft per lease+period)',
  })
  generateFromSchedules(
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: GenerateInvoiceFromSchedulesDto,
  ) {
    return this.service.generateFromSchedules(user, dto);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(...BILLING_WRITE_ROLES)
  @ApiOperation({ summary: 'Create draft invoice with lines' })
  create(
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(...BILLING_WRITE_ROLES)
  @ApiOperation({
    summary: 'Update draft invoice (partial fields; lines replace all lines when sent)',
  })
  updateDraft(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.service.updateDraft(id, user, dto);
  }

  @Post(':id/send-email')
  @UseGuards(RolesGuard)
  @Roles(...BILLING_WRITE_ROLES)
  @ApiOperation({ summary: 'Send invoice by email with PDF attachment' })
  sendEmail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: SendInvoiceEmailDto,
  ) {
    return this.service.sendEmail(id, user, dto);
  }

  @Post(':id/payments')
  @UseGuards(RolesGuard)
  @Roles(...BILLING_WRITE_ROLES)
  @ApiOperation({
    summary: 'Record payment allocation against an issued invoice',
  })
  allocatePayment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: AllocateInvoicePaymentDto,
  ) {
    return this.service.allocatePayment(id, user, dto);
  }

  @Post(':id/payments/:paymentId/reverse')
  @UseGuards(RolesGuard)
  @Roles(...BILLING_WRITE_ROLES)
  @ApiOperation({
    summary: 'Reverse an allocated payment (append-only ADJUSTMENT entry)',
  })
  reversePayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: ReverseInvoicePaymentDto,
  ) {
    return this.service.reversePayment(id, paymentId, user, dto);
  }

  @Post(':id/issue')
  @UseGuards(RolesGuard)
  @Roles(...BILLING_WRITE_ROLES)
  @ApiOperation({ summary: 'Issue invoice — posts one immutable ledger entry' })
  issue(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtAccessPayload,
  ) {
    return this.service.issue(id, user);
  }

  @Post(':id/void')
  @UseGuards(RolesGuard)
  @Roles(...BILLING_WRITE_ROLES)
  @ApiOperation({ summary: 'Void draft invoice' })
  voidInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtAccessPayload,
  ) {
    return this.service.voidInvoice(id, user);
  }
}
