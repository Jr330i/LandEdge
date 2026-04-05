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
import { PROPERTY_WRITE_ROLES } from './property.constants';
import { BuildingsService } from './buildings.service';
import { CreateBuildingDto } from './dto/create-building.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';

@ApiTags('buildings')
@ApiBearerAuth()
@Controller('buildings')
export class BuildingsController {
  constructor(private readonly buildingsService: BuildingsService) {}

  @Get()
  @ApiOperation({ summary: 'List buildings in a portfolio' })
  @ApiQuery({ name: 'portfolioId', required: true })
  findAll(
    @Query('portfolioId', ParseUUIDPipe) portfolioId: string,
    @CurrentUser() user: JwtAccessPayload,
  ) {
    return this.buildingsService.findAll(portfolioId, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get building by id' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtAccessPayload,
  ) {
    return this.buildingsService.findOne(id, user);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(...PROPERTY_WRITE_ROLES)
  @ApiOperation({ summary: 'Create building' })
  @ApiCreatedResponse({ description: 'Building created' })
  create(
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: CreateBuildingDto,
  ) {
    return this.buildingsService.create(user, dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(...PROPERTY_WRITE_ROLES)
  @ApiOperation({ summary: 'Update building' })
  patch(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: UpdateBuildingDto,
  ) {
    return this.buildingsService.update(id, user, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(...PROPERTY_WRITE_ROLES)
  @ApiOperation({ summary: 'Delete building' })
  @ApiOkResponse({ description: 'Building removed' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtAccessPayload,
  ) {
    return this.buildingsService.remove(id, user);
  }
}
