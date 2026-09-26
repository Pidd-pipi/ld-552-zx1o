import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateOfferDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  salary?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  // true：保存调整后的条件并提交审批（新版本）
  @IsOptional()
  @IsBoolean()
  submit?: boolean;
}
