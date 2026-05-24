import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateOrganizationInvoiceProfileDto {
  @ApiPropertyOptional({ example: 'Acme Property Management (Pty) Ltd' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  invoiceLegalName?: string;

  @ApiPropertyOptional({ example: '1001234567', description: 'ZRA TPIN' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  invoiceTaxNumber?: string;

  @ApiPropertyOptional({ example: 'Plot 123, Cairo Road, Lusaka, Zambia' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  invoiceAddress?: string;

  @ApiPropertyOptional({ example: '+260 211 123456' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  invoicePhone?: string;

  @ApiPropertyOptional({ example: 'accounts@example.co.zm' })
  @IsOptional()
  @IsString()
  @MaxLength(320)
  invoiceEmail?: string;

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
