import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateFloorDto } from './create-floor.dto';

export class UpdateFloorDto extends PartialType(
  OmitType(CreateFloorDto, ['buildingId'] as const),
) {}
