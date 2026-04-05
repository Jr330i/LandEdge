import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeaseStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { LeaseUnitLineDto } from './lease-unit-line.dto';

export class CreateLeaseDto {
  @ApiProperty()
  @IsUUID()
  tenantId!: string;

  @ApiProperty({ example: '2025-01-01' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2028-12-31' })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ enum: LeaseStatus })
  @IsOptional()
  @IsEnum(LeaseStatus)
  status?: LeaseStatus;

  @ApiPropertyOptional({ description: 'Structured lease terms / metadata (JSON)' })
  @IsOptional()
  @IsObject()
  terms?: Record<string, unknown>;

  @ApiProperty({ type: [LeaseUnitLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LeaseUnitLineDto)
  units!: LeaseUnitLineDto[];
}
