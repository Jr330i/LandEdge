import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'demo' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  organizationSlug!: string;

  @ApiProperty({ example: 'super@demo.sofinda.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'demo123', minLength: 6 })
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password!: string;
}
