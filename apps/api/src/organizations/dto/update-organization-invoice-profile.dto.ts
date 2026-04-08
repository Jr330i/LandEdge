import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateOrganizationInvoiceProfileDto {
  @ApiPropertyOptional({ example: 'Acme Property Management (Pty) Ltd' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  invoiceLegalName?: string;

  @ApiPropertyOptional({ example: 'ZA1234567890' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  invoiceTaxNumber?: string;

  @ApiPropertyOptional({ example: 'Acme Bank, Account 123456, Branch 250655' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  invoiceBankDetails?: string;

  @ApiPropertyOptional({
    example: 'Pay within 7 days to avoid service interruption.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  invoicePaymentInstructions?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png' })
  @IsOptional()
  @IsUrl({ require_tld: true })
  @MaxLength(1000)
  invoiceLogoUrl?: string;
}
