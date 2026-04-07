import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { CreateInvoiceLineDto } from './create-invoice-line.dto';

export class UpdateInvoiceDto {
  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsDateString()
  dueDate?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceLineDto)
  lines?: CreateInvoiceLineDto[];
}
