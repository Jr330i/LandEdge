import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UnitStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUnitDto {
  @ApiProperty()
  @IsUUID()
  floorId!: string;

  @ApiProperty({ example: 'L1-101' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  code!: string;

  @ApiProperty({ example: 'retail' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  type!: string;

  @ApiPropertyOptional({ example: 125.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  rentableArea?: number;

  @ApiPropertyOptional({ enum: UnitStatus })
  @IsOptional()
  @IsEnum(UnitStatus)
  status?: UnitStatus;
}
