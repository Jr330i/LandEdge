import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { InvoiceStatus, UserRole } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtAccessPayload } from '../auth/jwt.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { invoicePdfFilename } from '../billing/invoice-pdf.builder';
import { PortalService } from './portal.service';

@ApiTags('portal')
@ApiBearerAuth()
@Controller('portal')
@UseGuards(RolesGuard)
export class PortalController {
  constructor(private readonly portal: PortalService) {}

  @Get('tenant')
  @Roles(UserRole.TENANT_USER)
  @ApiOperation({ summary: 'Tenant portal home snapshot' })
  tenantHome(@CurrentUser() user: JwtAccessPayload) {
    return this.portal.tenantSnapshot(user);
  }

  @Get('tenant/invoices')
  @Roles(UserRole.TENANT_USER)
  @ApiOperation({ summary: 'List invoices for the linked tenant' })
  @ApiQuery({ name: 'status', required: false, enum: InvoiceStatus })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  tenantInvoices(
    @CurrentUser() user: JwtAccessPayload,
    @Query('status') statusRaw?: string,
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
    return this.portal.tenantInvoices(user, {
      status,
      page: Number.isFinite(page) ? page : undefined,
      pageSize: Number.isFinite(pageSize) ? pageSize : undefined,
    });
  }

  @Get('tenant/invoices/:id/pdf')
  @Roles(UserRole.TENANT_USER)
  @ApiOperation({ summary: 'Download tax invoice PDF (tenant-scoped)' })
  @ApiProduces('application/pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Cache-Control', 'no-store')
  async tenantInvoicePdf(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtAccessPayload,
  ): Promise<StreamableFile> {
    const buffer = await this.portal.tenantInvoicePdf(user, id);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${invoicePdfFilename(id)}"`,
      length: buffer.length,
    });
  }

  @Get('tenant/invoices/:id')
  @Roles(UserRole.TENANT_USER)
  @ApiOperation({ summary: 'Get invoice detail (tenant-scoped)' })
  tenantInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtAccessPayload,
  ) {
    return this.portal.tenantInvoice(user, id);
  }

  @Get('tenant/statement/export')
  @Roles(UserRole.TENANT_USER)
  @ApiOperation({ summary: 'Download account statement as CSV' })
  @ApiProduces('text/csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  async tenantStatementExport(
    @CurrentUser() user: JwtAccessPayload,
  ): Promise<StreamableFile> {
    const csv = await this.portal.tenantStatementCsv(user);
    const buffer = Buffer.from(csv, 'utf8');
    return new StreamableFile(buffer, {
      type: 'text/csv; charset=utf-8',
      disposition: 'attachment; filename="account-statement.csv"',
      length: buffer.length,
    });
  }

  @Get('tenant/statement')
  @Roles(UserRole.TENANT_USER)
  @ApiOperation({ summary: 'Account statement (ledger lines for linked tenant)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  tenantStatement(
    @CurrentUser() user: JwtAccessPayload,
    @Query('page') pageRaw?: string,
    @Query('pageSize') pageSizeRaw?: string,
  ) {
    const page = pageRaw ? Number.parseInt(pageRaw, 10) : undefined;
    const pageSize = pageSizeRaw ? Number.parseInt(pageSizeRaw, 10) : undefined;
    return this.portal.tenantStatement(user, {
      page: Number.isFinite(page) ? page : undefined,
      pageSize: Number.isFinite(pageSize) ? pageSize : undefined,
    });
  }

  @Get('tenant/leases')
  @Roles(UserRole.TENANT_USER)
  @ApiOperation({ summary: 'Leases and units for the linked tenant' })
  tenantLeases(@CurrentUser() user: JwtAccessPayload) {
    return this.portal.tenantLeases(user);
  }

  @Get('owner')
  @Roles(UserRole.OWNER_USER)
  @ApiOperation({ summary: 'Owner portal home snapshot' })
  ownerHome(@CurrentUser() user: JwtAccessPayload) {
    return this.portal.ownerSnapshot(user);
  }

  @Get('owner/properties')
  @Roles(UserRole.OWNER_USER)
  @ApiOperation({ summary: 'Portfolio and building summary for owners' })
  ownerProperties(@CurrentUser() user: JwtAccessPayload) {
    return this.portal.ownerProperties(user);
  }

  @Get('owner/invoices/:id/pdf')
  @Roles(UserRole.OWNER_USER)
  @ApiOperation({ summary: 'Download invoice PDF (owner read-only)' })
  @ApiProduces('application/pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Cache-Control', 'no-store')
  async ownerInvoicePdf(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtAccessPayload,
  ): Promise<StreamableFile> {
    const buffer = await this.portal.ownerInvoicePdf(user, id);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${invoicePdfFilename(id)}"`,
      length: buffer.length,
    });
  }

  @Get('owner/invoices/:id')
  @Roles(UserRole.OWNER_USER)
  @ApiOperation({ summary: 'Get invoice detail (owner read-only)' })
  ownerInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtAccessPayload,
  ) {
    return this.portal.ownerInvoice(user, id);
  }


  @Get('owner/invoices')
  @Roles(UserRole.OWNER_USER)
  @ApiOperation({ summary: 'Organization invoices (read-only owner view)' })
  @ApiQuery({ name: 'status', required: false, enum: InvoiceStatus })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  ownerInvoices(
    @CurrentUser() user: JwtAccessPayload,
    @Query('status') statusRaw?: string,
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
    return this.portal.ownerInvoices(user, {
      status,
      page: Number.isFinite(page) ? page : undefined,
      pageSize: Number.isFinite(pageSize) ? pageSize : undefined,
    });
  }
}
