import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Password reset token from email link' })
  @IsString()
  @MinLength(20)
  token!: string;

  @ApiProperty({ minLength: 6, example: 'newpass123' })
  @IsString()
  @MinLength(6)
  password!: string;
}
