import { Body, Controller, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtAccessPayload } from '../auth/jwt.types';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { BILLING_WRITE_ROLES } from './billing.constants';
import { CreatePaymentCheckoutDto } from './dto/create-payment-checkout.dto';
import { PaymentsService } from './payments.service';

type RequestWithRawBody = Request & { rawBody?: Buffer };

@ApiTags('billing — payments')
@ApiBearerAuth()
@Controller('billing/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('checkout')
  @UseGuards(RolesGuard)
  @Roles(...BILLING_WRITE_ROLES)
  @ApiOperation({
    summary:
      'Initialize Lipila mobile-money collection for an issued invoice (proximity / STK-style prompt)',
  })
  @ApiOkResponse({
    description: 'Collection reference and optional redirect URL',
  })
  checkout(
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: CreatePaymentCheckoutDto,
  ) {
    return this.paymentsService.createCheckout(user, dto);
  }

  @Post('webhooks/lipila')
  @Public()
  @ApiOperation({
    summary: 'Lipila payment webhook (Standard Webhooks signature)',
  })
  @ApiOkResponse({ description: 'Webhook accepted' })
  lipilaWebhook(@Req() req: RequestWithRawBody) {
    return this.paymentsService.handleLipilaWebhook(req);
  }
}
