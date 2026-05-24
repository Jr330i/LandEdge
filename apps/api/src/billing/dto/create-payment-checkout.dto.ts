import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePaymentCheckoutDto {
  @ApiProperty()
  @IsUUID()
  invoiceId!: string;

  @ApiPropertyOptional({ description: 'Optional partial payment amount' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  narrative?: string;

  @ApiPropertyOptional({
    description:
      'Mobile money MSISDN Lipila will prompt (E.164-style digits). Falls back to tenant contactPhone.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  accountNumber?: string;

  @ApiPropertyOptional({
    description: 'Optional payer email forwarded to Lipila',
  })
  @IsOptional()
  @IsString()
  @MaxLength(320)
  email?: string;
}
