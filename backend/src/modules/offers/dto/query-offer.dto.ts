import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional } from 'class-validator';
import { OfferStatus } from '../../../constants/enums';

export class QueryOfferDto {
  @IsOptional()
  @IsIn(Object.values(OfferStatus))
  status?: OfferStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  candidateId?: number;
}
