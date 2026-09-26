import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { Roles } from '../../decorators/roles.decorator';
import { OfferStatus, UserRole } from '../../constants/enums';
import { OffersService } from './offers.service';

@Controller('offers')
export class OffersController {
  constructor(private offers: OffersService) {}

  /** 招聘经理的待审批工作台：只返回分配给自己的待审批 Offer */
  @Get('pending')
  @Roles(UserRole.HIRING_MANAGER, UserRole.ADMIN)
  pending(@Req() req: any) {
    return this.offers.findPendingFor(req.user.sub, req.user.role === UserRole.ADMIN);
  }

  @Post()
  @Roles(UserRole.HR, UserRole.ADMIN)
  create(@Body() body: { candidateId: number; jobId: number; salary: number; startDate: string }) {
    return this.offers.create(body);
  }

  /** HR 提交审批（DRAFT / 被拒未发送 → PENDING_APPROVAL） */
  @Post(':id/submit')
  @Roles(UserRole.HR, UserRole.ADMIN)
  submit(@Param('id') id: string, @Req() req: any, @Body() body: { reason?: string }) {
    return this.offers.submit(+id, req.user.sub, body?.reason);
  }

  /** HR 调整薪资 / 入职日期，条件变化后版本升级并重新进入待审批 */
  @Patch(':id/conditions')
  @Roles(UserRole.HR, UserRole.ADMIN)
  adjust(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: { salary?: number; startDate?: string },
  ) {
    return this.offers.adjustConditions(+id, req.user.sub, body);
  }

  /** 招聘经理审批通过 */
  @Post(':id/approve')
  @Roles(UserRole.HIRING_MANAGER, UserRole.ADMIN)
  approve(@Param('id') id: string, @Req() req: any, @Body() body: { comment?: string }) {
    return this.offers.decide(+id, req.user, 'APPROVED', body?.comment);
  }

  /** 招聘经理审批拒绝（必须填写原因，由服务端校验） */
  @Post(':id/reject')
  @Roles(UserRole.HIRING_MANAGER, UserRole.ADMIN)
  reject(@Param('id') id: string, @Req() req: any, @Body() body: { reason?: string }) {
    return this.offers.decide(+id, req.user, 'REJECTED', body?.reason);
  }

  /** HR 发送已通过当前版本审批的 Offer */
  @Post(':id/send')
  @Roles(UserRole.HR, UserRole.ADMIN)
  send(@Param('id') id: string) {
    return this.offers.send(+id);
  }

  /** 发送后的候选人侧状态流转：ACCEPTED / REJECTED / WITHDRAWN */
  @Patch(':id/status')
  @Roles(UserRole.HR, UserRole.ADMIN)
  status(@Param('id') id: string, @Body() body: { status: OfferStatus; reason?: string }) {
    return this.offers.updateStatus(+id, body.status, body.reason);
  }
}
