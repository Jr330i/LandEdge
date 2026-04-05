import { LedgerSource } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  NotEquals,
} from 'class-validator';

export class ManualLedgerDto {
  @IsUUID('4')
  leaseId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  narrative!: string;

  @Type(() => Number)
  @IsNumber()
  @NotEquals(0, { message: 'signedAmount must not be zero' })
  signedAmount!: number;

  @IsIn([LedgerSource.PAYMENT, LedgerSource.ADJUSTMENT])
  source!: LedgerSource;
}
