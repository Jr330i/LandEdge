import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class ReorderUnitsDto {
  @ApiProperty()
  @IsUUID('4')
  floorId!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  unitIds!: string[];
}
