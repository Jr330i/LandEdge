import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'demo' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  organizationSlug!: string;

  @ApiProperty({ example: 'tenant@demo.sofinda.local' })
  @IsEmail()
  email!: string;
}
