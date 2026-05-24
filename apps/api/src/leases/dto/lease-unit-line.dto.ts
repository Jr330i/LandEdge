import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class LeaseUnitLineDto {
  @ApiProperty()
  @IsUUID()
  unitId!: string;

  @ApiPropertyOptional({
    description: 'Share of lease for this unit, default 100',
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  @Max(100)
  percentageAllocated?: number;
}
