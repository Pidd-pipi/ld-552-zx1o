import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { OfferStatus } from '../../../constants/enums';

export class UpdateOfferStatusDto {
  @IsIn([OfferStatus.SENT, OfferStatus.ACCEPTED, OfferStatus.REJECTED, OfferStatus.WITHDRAWN])
  status: OfferStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
