import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { ChargeSchedulesService } from './charge-schedules.service';
import { CreateChargeScheduleDto } from './dto/create-charge-schedule.dto';
import { UpdateChargeScheduleDto } from './dto/update-charge-schedule.dto';

@ApiTags('billing — charge schedules')
@ApiBearerAuth()
@Controller('billing/charge-schedules')
export class ChargeSchedulesController {
  constructor(private readonly service: ChargeSchedulesService) {}

  @Get()
  @ApiOperation({ summary: 'List charge schedules for a lease' })
  @ApiQuery({ name: 'leaseId', required: true })
  findAll(
    @CurrentUser() user: JwtAccessPayload,
    @Query('leaseId', ParseUUIDPipe) leaseId: string,
  ) {
    return this.service.findAllForLease(user, leaseId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(...BILLING_WRITE_ROLES)
  @ApiOperation({ summary: 'Create charge schedule on a lease' })
  create(
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: CreateChargeScheduleDto,
  ) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(...BILLING_WRITE_ROLES)
  @ApiOperation({ summary: 'Update charge schedule' })
  patch(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: UpdateChargeScheduleDto,
  ) {
    return this.service.update(id, user, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(...BILLING_WRITE_ROLES)
  @ApiOperation({ summary: 'Delete charge schedule' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtAccessPayload,
  ) {
    return this.service.remove(id, user);
  }
}
