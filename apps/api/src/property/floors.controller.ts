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
import { CreateFloorDto } from './dto/create-floor.dto';
import { ReorderFloorsDto } from './dto/reorder-floors.dto';
import { UpdateFloorDto } from './dto/update-floor.dto';
import { FloorsService } from './floors.service';

@ApiTags('floors')
@ApiBearerAuth()
@Controller('floors')
export class FloorsController {
  constructor(private readonly floorsService: FloorsService) {}

  @Get()
  @ApiOperation({ summary: 'List floors on a building' })
  @ApiQuery({ name: 'buildingId', required: true })
  findAll(
    @Query('buildingId', ParseUUIDPipe) buildingId: string,
    @CurrentUser() user: JwtAccessPayload,
  ) {
    return this.floorsService.findAll(buildingId, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get floor by id' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtAccessPayload,
  ) {
    return this.floorsService.findOne(id, user);
  }

  @Post('reorder')
  @UseGuards(RolesGuard)
  @Roles(...PROPERTY_WRITE_ROLES)
  @ApiOperation({ summary: 'Reorder floors within a building' })
  reorder(
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: ReorderFloorsDto,
  ) {
    return this.floorsService.reorder(dto.buildingId, dto.floorIds, user);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(...PROPERTY_WRITE_ROLES)
  @ApiOperation({ summary: 'Create floor' })
  @ApiCreatedResponse({ description: 'Floor created' })
  create(
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: CreateFloorDto,
  ) {
    return this.floorsService.create(user, dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(...PROPERTY_WRITE_ROLES)
  @ApiOperation({ summary: 'Update floor' })
  patch(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: UpdateFloorDto,
  ) {
    return this.floorsService.update(id, user, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(...PROPERTY_WRITE_ROLES)
  @ApiOperation({ summary: 'Delete floor' })
  @ApiOkResponse({ description: 'Floor removed' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtAccessPayload,
  ) {
    return this.floorsService.remove(id, user);
  }
}
