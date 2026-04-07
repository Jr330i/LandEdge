import { BillingFrequency, ChargeKind } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateChargeScheduleDto {
  @IsOptional()
  @IsEnum(ChargeKind)
  kind?: ChargeKind;

  @IsOptional()
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label?: string | null;

  @IsOptional()
  @Type(() => Number)
  amount?: number;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsEnum(BillingFrequency)
  frequency?: BillingFrequency;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
