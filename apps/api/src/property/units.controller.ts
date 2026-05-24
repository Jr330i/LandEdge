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
import { CONSOLE_ACCESS_ROLES } from '../auth/role-matrix.constants';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PROPERTY_WRITE_ROLES } from './property.constants';
import { CreateUnitDto } from './dto/create-unit.dto';
import { ReorderUnitsDto } from './dto/reorder-units.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitsService } from './units.service';

@ApiTags('units')
@ApiBearerAuth()
@Controller('units')
@UseGuards(RolesGuard)
@Roles(...CONSOLE_ACCESS_ROLES)
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Get()
  @ApiOperation({ summary: 'List units on a floor' })
  @ApiQuery({ name: 'floorId', required: true })
  findAll(
    @Query('floorId', ParseUUIDPipe) floorId: string,
    @CurrentUser() user: JwtAccessPayload,
  ) {
    return this.unitsService.findAll(floorId, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get unit by id' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtAccessPayload,
  ) {
    return this.unitsService.findOne(id, user);
  }

  @Post('reorder')
  @UseGuards(RolesGuard)
  @Roles(...PROPERTY_WRITE_ROLES)
  @ApiOperation({ summary: 'Reorder units within a floor' })
  reorder(@CurrentUser() user: JwtAccessPayload, @Body() dto: ReorderUnitsDto) {
    return this.unitsService.reorder(dto.floorId, dto.unitIds, user);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(...PROPERTY_WRITE_ROLES)
  @ApiOperation({ summary: 'Create unit' })
  @ApiCreatedResponse({ description: 'Unit created' })
  create(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateUnitDto) {
    return this.unitsService.create(user, dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(...PROPERTY_WRITE_ROLES)
  @ApiOperation({ summary: 'Update unit' })
  patch(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: UpdateUnitDto,
  ) {
    return this.unitsService.update(id, user, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(...PROPERTY_WRITE_ROLES)
  @ApiOperation({ summary: 'Delete unit' })
  @ApiOkResponse({ description: 'Unit removed' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtAccessPayload,
  ) {
    return this.unitsService.remove(id, user);
  }
}
