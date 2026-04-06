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
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { LEASE_WRITE_ROLES } from './lease.constants';
import { TenantsService } from './tenants.service';

@ApiTags('tenants')
@ApiBearerAuth()
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  @ApiOperation({ summary: 'List tenants' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, example: 20 })
  findAll(
    @CurrentUser() user: JwtAccessPayload,
    @Query('q') q?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize?: number,
  ) {
    return this.tenantsService.findAll(user, { q, page, pageSize });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tenant by id' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtAccessPayload,
  ) {
    return this.tenantsService.findOne(id, user);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(...LEASE_WRITE_ROLES)
  @ApiOperation({ summary: 'Create tenant' })
  @ApiCreatedResponse()
  create(
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: CreateTenantDto,
  ) {
    return this.tenantsService.create(user, dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(...LEASE_WRITE_ROLES)
  @ApiOperation({ summary: 'Update tenant' })
  patch(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenantsService.update(id, user, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(...LEASE_WRITE_ROLES)
  @ApiOperation({ summary: 'Delete tenant (no leases)' })
  @ApiOkResponse()
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtAccessPayload,
  ) {
    return this.tenantsService.remove(id, user);
  }
}
