import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Acme Property Management' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({
    description: 'URL-safe slug; generated from name if omitted',
    example: 'acme-pm',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase letters, numbers, and single hyphens',
  })
  slug?: string;

  @ApiPropertyOptional({ example: 'Africa/Johannesburg' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({ example: 'ZAR' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  baseCurrency?: string;
}
