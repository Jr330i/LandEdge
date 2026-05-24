import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateOrganizationUserDto {
  @ApiProperty({ example: 'manager@acme.sofinda.local' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: 'Jane Manager' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @ApiProperty({ enum: UserRole, example: UserRole.PORTFOLIO_MANAGER })
  @IsEnum(UserRole)
  role!: UserRole;

  @ApiProperty({ minLength: 6, example: 'demo123' })
  @IsString()
  @MinLength(6)
  password!: string;
}
