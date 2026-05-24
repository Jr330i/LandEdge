import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateOrganizationUserDto {
  @ApiPropertyOptional({ example: 'manager@acme.sofinda.local' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'Jane Manager', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string | null;

  @ApiPropertyOptional({ enum: UserRole, example: UserRole.FINANCE })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ minLength: 6, example: 'newpass123' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
