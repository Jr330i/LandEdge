import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class ReorderChargeSchedulesDto {
  @ApiProperty()
  @IsUUID('4')
  leaseId!: string;

  @ApiProperty({ type: [String], description: 'All schedule ids for the lease, in order' })
  @IsArray()
  @IsUUID('4', { each: true })
  chargeScheduleIds!: string[];
}
