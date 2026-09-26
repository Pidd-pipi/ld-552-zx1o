import { Controller, Get, Param } from '@nestjs/common';
import { Roles } from '../../decorators/roles.decorator';
import { UserRole } from '../../constants/enums';
import { AuditService } from './audit.service';

@Controller('audit-logs')
export class AuditController {
  constructor(private audit: AuditService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  all() { return this.audit.all(); }

  /** 候选人详情页的状态流转：HR 与招聘经理同样可见 */
  @Get('candidate/:id')
  @Roles(UserRole.HR, UserRole.HIRING_MANAGER, UserRole.ADMIN)
  candidate(@Param('id') id: string) { return this.audit.candidate(+id); }
}
