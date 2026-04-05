import { ApiPropertyOptional } from '@nestjs/swagger';
import { LeaseStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { LeaseUnitLineDto } from './lease-unit-line.dto';

export class UpdateLeaseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: LeaseStatus })
  @IsOptional()
  @IsEnum(LeaseStatus)
  status?: LeaseStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  terms?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: [LeaseUnitLineDto],
    description:
      'When set, replaces all lease–unit links (same org overlap rules as create).',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LeaseUnitLineDto)
  units?: LeaseUnitLineDto[];
}
