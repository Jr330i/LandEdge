import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateBuildingDto } from './create-building.dto';

export class UpdateBuildingDto extends PartialType(
  OmitType(CreateBuildingDto, ['portfolioId'] as const),
) {}
