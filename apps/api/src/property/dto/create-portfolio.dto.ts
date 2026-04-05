import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreatePortfolioDto {
  @ApiProperty({ example: 'Retail — Western Cape' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: 'ZA-WC' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string;

  @ApiPropertyOptional({
    description: 'Target organization (SUPER_ADMIN only); defaults to caller org',
  })
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}
