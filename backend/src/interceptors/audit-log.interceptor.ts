import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const bodyStatus = req.body?.status ?? req.body?.result;
    return next.handle().pipe(tap(async (payload: any) => {
      const entity = this.detectEntity(req.path);
      const entityId = Number(req.params?.id || payload?.id || payload?.resumeId || payload?.offerId || 0);
      // 新审批端点（submit/approve/reject/send/conditions）不在请求体中带 status，以响应体为准
      const finalAfter = payload?.beforeStatus !== undefined
        ? (payload?.status ?? payload?.result)
        : (payload?.status ?? payload?.result ?? bodyStatus);
      const finalBefore = payload?.beforeStatus ?? req.body?.beforeStatus;
      const reason = payload?.reason ?? req.body?.reason ?? req.body?.comment;
      if (!entity || !entityId || !finalAfter || finalBefore === finalAfter) return;
      await this.prisma.auditLog.create({ data: {
        actorId: req.user?.sub,
        action: `${entity}_STATUS_CHANGE`,
        entity,
        entityId,
        beforeStatus: finalBefore,
        afterStatus: finalAfter,
        reason,
        ipAddress: req.ip,
        candidateId: payload?.candidateId,
      }});
    }));
  }
  private detectEntity(path: string): string | null {
    if (path.includes('jobs')) return 'Job';
    if (path.includes('resumes')) return 'Resume';
    if (path.includes('interviews')) return 'Interview';
    if (path.includes('offers')) return 'Offer';
    return null;
  }
}
