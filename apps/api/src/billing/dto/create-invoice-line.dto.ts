import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  Min,
} from 'class-validator';

export class CreateInvoiceLineDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  description!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsUUID('4')
  chargeScheduleId?: string;
}
