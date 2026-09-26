import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateOfferDto {
  @IsInt()
  @Type(() => Number)
  candidateId: number;

  @IsInt()
  @Type(() => Number)
  jobId: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  salary: number;

  @IsDateString()
  startDate: string;

  // true：创建后直接提交审批；false/缺省：保存为草稿
  @IsOptional()
  @IsBoolean()
  submit?: boolean;
}
