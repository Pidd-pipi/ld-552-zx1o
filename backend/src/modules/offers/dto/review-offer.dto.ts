import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { OfferApprovalDecision } from '../../../constants/enums';

export class ReviewOfferDto {
  @IsIn([OfferApprovalDecision.APPROVED, OfferApprovalDecision.REJECTED])
  decision: OfferApprovalDecision.APPROVED | OfferApprovalDecision.REJECTED;

  // 拒绝时必填（service 中再次校验并给出明确报错）
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
