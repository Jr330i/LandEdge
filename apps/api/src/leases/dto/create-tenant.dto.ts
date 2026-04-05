import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({ example: 'Acme Retail (Pty) Ltd' })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  legalName!: string;

  @ApiPropertyOptional({ example: 'Acme Store' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  tradingName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactPhone?: string;
}
