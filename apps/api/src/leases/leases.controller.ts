import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtAccessPayload } from '../auth/jwt.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateLeaseDto } from './dto/create-lease.dto';
import { UpdateLeaseDto } from './dto/update-lease.dto';
import { LEASE_WRITE_ROLES } from './lease.constants';
import { LeasesService } from './leases.service';

@ApiTags('leases')
@ApiBearerAuth()
@Controller('leases')
export class LeasesController {
  constructor(private readonly leasesService: LeasesService) {}

  @Get()
  @ApiOperation({ summary: 'List leases' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, example: 20 })
  findAll(
    @CurrentUser() user: JwtAccessPayload,
    @Query('tenantId', new ParseUUIDPipe({ version: '4', optional: true }))
    tenantId?: string,
    @Query('q') q?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize?: number,
  ) {
    return this.leasesService.findAll(user, { tenantId, q, page, pageSize });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lease by id' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtAccessPayload,
  ) {
    return this.leasesService.findOne(id, user);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(...LEASE_WRITE_ROLES)
  @ApiOperation({ summary: 'Create lease with unit links (FR-007 one-to-many)' })
  @ApiCreatedResponse()
  create(
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: CreateLeaseDto,
  ) {
    return this.leasesService.create(user, dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(...LEASE_WRITE_ROLES)
  @ApiOperation({ summary: 'Update lease' })
  patch(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: UpdateLeaseDto,
  ) {
    return this.leasesService.update(id, user, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(...LEASE_WRITE_ROLES)
  @ApiOperation({ summary: 'Delete lease' })
  @ApiOkResponse()
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtAccessPayload,
  ) {
    return this.leasesService.remove(id, user);
  }
}
