import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class ReorderBuildingsDto {
  @ApiProperty()
  @IsUUID('4')
  portfolioId!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  buildingIds!: string[];
}
