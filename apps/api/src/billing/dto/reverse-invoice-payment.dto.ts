import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReverseInvoicePaymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
