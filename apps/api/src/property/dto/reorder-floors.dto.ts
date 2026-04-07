import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class ReorderFloorsDto {
  @ApiProperty()
  @IsUUID('4')
  buildingId!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  floorIds!: string[];
}
