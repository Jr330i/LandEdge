import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtAccessPayload } from '../auth/jwt.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { BILLING_WRITE_ROLES } from './billing.constants';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { GenerateInvoiceFromSchedulesDto } from './dto/generate-invoice-from-schedules.dto';
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
  findAll(
    @CurrentUser() user: JwtAccessPayload,
    @Query('leaseId', new ParseUUIDPipe({ version: '4', optional: true }))
    leaseId?: string,
    @Query('tenantId', new ParseUUIDPipe({ version: '4', optional: true }))
    tenantId?: string,
  ) {
    return this.service.findAll(user, { leaseId, tenantId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice by id' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtAccessPayload,
  ) {
    return this.service.findOne(id, user);
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
