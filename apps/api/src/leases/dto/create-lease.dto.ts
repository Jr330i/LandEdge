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
  ValidateIf,
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

  @ApiPropertyOptional({
    description: 'Structured lease terms / metadata (JSON)',
  })
  @IsOptional()
  @IsObject()
  terms?: Record<string, unknown>;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Optional staff user (same organization) attributed for collections / performance.',
  })
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsUUID()
  brokerUserId?: string | null;

  @ApiProperty({ type: [LeaseUnitLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LeaseUnitLineDto)
  units!: LeaseUnitLineDto[];
}
