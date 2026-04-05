import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class GenerateInvoiceFromSchedulesDto {
  @IsUUID('4')
  leaseId!: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  /** If true (default), return existing draft for the same lease + period instead of creating another. */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  skipIfDraftExists?: boolean;
}
