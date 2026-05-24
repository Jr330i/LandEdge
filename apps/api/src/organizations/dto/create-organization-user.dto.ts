import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
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

  @ApiPropertyOptional({
    minLength: 6,
    example: 'demo123',
    description: 'Omit to create a pending user and send an invite email instead',
  })
  @ValidateIf((o: CreateOrganizationUserDto) => o.password !== undefined)
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({
    description: 'Send invite email when password is omitted (default true when no password)',
  })
  @IsOptional()
  @IsBoolean()
  sendInviteEmail?: boolean;
}
