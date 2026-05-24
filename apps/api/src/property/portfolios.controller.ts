import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtAccessPayload } from '../auth/jwt.types';
import { CONSOLE_ACCESS_ROLES } from '../auth/role-matrix.constants';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PROPERTY_WRITE_ROLES } from './property.constants';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { UpdatePortfolioDto } from './dto/update-portfolio.dto';
import { PortfoliosService } from './portfolios.service';

@ApiTags('portfolios')
@ApiBearerAuth()
@Controller('portfolios')
@UseGuards(RolesGuard)
@Roles(...CONSOLE_ACCESS_ROLES)
export class PortfoliosController {
  constructor(private readonly portfoliosService: PortfoliosService) {}

  @Get()
  @ApiOperation({ summary: 'List portfolios for the current tenant' })
  findAll(@CurrentUser() user: JwtAccessPayload) {
    return this.portfoliosService.findAll(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get portfolio by id' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtAccessPayload,
  ) {
    return this.portfoliosService.findOne(id, user);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(...PROPERTY_WRITE_ROLES)
  @ApiOperation({ summary: 'Create portfolio' })
  @ApiCreatedResponse({ description: 'Portfolio created' })
  create(
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: CreatePortfolioDto,
  ) {
    return this.portfoliosService.create(user, dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(...PROPERTY_WRITE_ROLES)
  @ApiOperation({ summary: 'Update portfolio' })
  patch(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: UpdatePortfolioDto,
  ) {
    return this.portfoliosService.update(id, user, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(...PROPERTY_WRITE_ROLES)
  @ApiOperation({ summary: 'Delete portfolio' })
  @ApiOkResponse({ description: 'Portfolio removed' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtAccessPayload,
  ) {
    return this.portfoliosService.remove(id, user);
  }
}
