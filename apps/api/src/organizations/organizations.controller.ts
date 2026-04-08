import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtAccessPayload } from '../auth/jwt.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationInvoiceProfileDto } from './dto/update-organization-invoice-profile.dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Provision organization (SUPER_ADMIN only)' })
  @ApiCreatedResponse({ description: 'Organization created' })
  create(
    @Body() dto: CreateOrganizationDto,
    @CurrentUser() user: JwtAccessPayload,
  ) {
    return this.organizationsService.create(dto, user);
  }

  @Get()
  @ApiOperation({
    summary: 'List organizations visible to the caller',
    description:
      'SUPER_ADMIN: all tenants. Others: own organization only (PRD data isolation).',
  })
  @ApiOkResponse({ description: 'Organizations ordered by createdAt desc' })
  findAll(@CurrentUser() user: JwtAccessPayload) {
    return this.organizationsService.findAllForUser(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get organization by id (tenant-scoped)' })
  @ApiOkResponse({ description: 'Organization with user count' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtAccessPayload,
  ) {
    return this.organizationsService.findOneForUser(id, user);
  }

  @Patch(':id/invoice-profile')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @ApiOperation({
    summary: 'Update organization invoice profile (SUPER_ADMIN or own ORG_ADMIN)',
  })
  updateInvoiceProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationInvoiceProfileDto,
    @CurrentUser() user: JwtAccessPayload,
  ) {
    return this.organizationsService.updateInvoiceProfile(id, dto, user);
  }
}
