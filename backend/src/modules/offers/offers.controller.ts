import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Roles } from '../../decorators/roles.decorator';
import { UserRole } from '../../constants/enums';
import { OffersService } from './offers.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { ReviewOfferDto } from './dto/review-offer.dto';
import { UpdateOfferStatusDto } from './dto/update-offer-status.dto';
import { QueryOfferDto } from './dto/query-offer.dto';

@Controller('offers')
export class OffersController {
  constructor(private offers: OffersService) {}

  // HR / Admin 可见全部 Offer；招聘经理仅可见分配给自己的 Offer（service 内过滤）
  @Get()
  @Roles(UserRole.HR, UserRole.HIRING_MANAGER, UserRole.ADMIN)
  findAll(@Query() query: QueryOfferDto, @Req() req: any) {
    return this.offers.findAll(query, req.user);
  }

  @Get(':id')
  @Roles(UserRole.HR, UserRole.HIRING_MANAGER, UserRole.ADMIN)
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.offers.findOne(+id, req.user);
  }

  // HR 创建 Offer（草稿，或直接提交审批）
  @Post()
  @Roles(UserRole.HR, UserRole.ADMIN)
  create(@Body() body: CreateOfferDto, @Req() req: any) {
    return this.offers.create(body, req.user);
  }

  // HR 调整薪资 / 入职日期；审批通过后改动自动回到待审批；已发送不可编辑
  @Patch(':id')
  @Roles(UserRole.HR, UserRole.ADMIN)
  update(@Param('id') id: string, @Body() body: UpdateOfferDto, @Req() req: any) {
    return this.offers.update(+id, body, req.user);
  }

  // HR 提交审批
  @Post(':id/submit')
  @Roles(UserRole.HR, UserRole.ADMIN)
  submit(@Param('id') id: string, @Req() req: any) {
    return this.offers.submit(+id, req.user);
  }

  // 招聘经理审批（仅分配给自己的 Offer）；拒绝必须带原因
  @Post(':id/review')
  @Roles(UserRole.HIRING_MANAGER, UserRole.ADMIN)
  review(@Param('id') id: string, @Body() body: ReviewOfferDto, @Req() req: any) {
    return this.offers.review(+id, body, req.user);
  }

  // HR 发送 Offer：仅当前版本审批通过可发送
  @Post(':id/send')
  @Roles(UserRole.HR, UserRole.ADMIN)
  send(@Param('id') id: string) {
    return this.offers.send(+id);
  }

  // 发送后的回执 / 撤回：SENT -> ACCEPTED / REJECTED / WITHDRAWN
  @Patch(':id/status')
  @Roles(UserRole.HR, UserRole.ADMIN)
  status(@Param('id') id: string, @Body() body: UpdateOfferStatusDto) {
    return this.offers.updateStatus(+id, body);
  }
}
