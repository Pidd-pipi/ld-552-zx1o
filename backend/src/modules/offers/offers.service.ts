import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { publicUserSelect } from '../../prisma/selects';
import { OfferStatus } from '../../constants/enums';

const offerInclude = {
  candidate: true,
  job: true,
  approver: { select: publicUserSelect },
  assignedApprover: { select: publicUserSelect },
  approvals: {
    include: { actor: { select: publicUserSelect } },
    orderBy: { createdAt: 'desc' },
  },
} satisfies Prisma.OfferInclude;

@Injectable()
export class OffersService {
  constructor(private prisma: PrismaService) {}

  /** 招聘经理工作台：只看分配给自己、等待自己处理的 Offer；管理员可查看全部 */
  findPendingFor(approverId: number, isAdmin = false) {
    return this.prisma.offer.findMany({
      where: { status: OfferStatus.PENDING_APPROVAL, ...(isAdmin ? {} : { assignedApproverId: approverId }) },
      include: offerInclude,
      orderBy: { updatedAt: 'asc' },
    });
  }

  async create(data: { candidateId: number; jobId: number; salary: number | string; startDate: string }) {
    const job = await this.prisma.job.findUnique({ where: { id: Number(data.jobId) } });
    if (!job) throw new NotFoundException('关联职位不存在');
    const candidate = await this.prisma.candidate.findUnique({ where: { id: Number(data.candidateId) } });
    if (!candidate) throw new NotFoundException('候选人不存在');
    return this.prisma.offer.create({
      data: {
        candidateId: candidate.id,
        jobId: job.id,
        salary: new Prisma.Decimal(String(data.salary)),
        startDate: new Date(data.startDate),
        status: OfferStatus.DRAFT,
        version: 1,
        assignedApproverId: job.hiringManagerId,
      },
      include: offerInclude,
    });
  }

  /** HR 提交审批：草稿 / 被拒（尚未发送）的 Offer 进入待审批，并产生一条提交记录 */
  async submit(id: number, userId: number, reason?: string) {
    const offer = await this.getOrThrow(id);
    if (offer.sentAt) {
      throw new BadRequestException('已发送的录用通知不能再提交审批');
    }
    if (offer.status === OfferStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Offer 已在待审批中，等待招聘经理处理');
    }
    if (offer.status === OfferStatus.APPROVED) {
      throw new BadRequestException('Offer 已审批通过，无需重复提交');
    }
    await this.prisma.offer.update({
      where: { id },
      data: {
        status: OfferStatus.PENDING_APPROVAL,
        approverId: null,
        approvedVersion: null,
      },
    });
    await this.prisma.offerApproval.create({
      data: {
        offerId: id,
        version: offer.version,
        decision: 'SUBMITTED',
        salary: offer.salary,
        startDate: offer.startDate,
        reason: reason || null,
        actorId: userId,
        assignedApproverId: offer.assignedApproverId,
      },
    });
    return {
      ...(await this.reload(id)),
      beforeStatus: offer.status,
      candidateId: offer.candidateId,
    };
  }

  /**
   * HR 调整条件（薪资 / 入职日期）。
   * 一旦条件发生变化：版本号 +1，旧审批失效，状态回到待审批，并写入新的提交记录。
   * 已发送的 Offer 不允许编辑。
   */
  async adjustConditions(
    id: number,
    userId: number,
    body: { salary?: number | string; startDate?: string },
  ) {
    const offer = await this.getOrThrow(id);
    if (offer.sentAt) {
      throw new BadRequestException('已发送的录用通知不能再编辑');
    }
    const nextSalary = body.salary !== undefined ? new Prisma.Decimal(String(body.salary)) : offer.salary;
    const nextStartDate = body.startDate !== undefined ? new Date(body.startDate) : offer.startDate;
    const salaryChanged = !nextSalary.equals(offer.salary);
    const startDateChanged = nextStartDate.getTime() !== offer.startDate.getTime();
    if (!salaryChanged && !startDateChanged) {
      throw new BadRequestException('条件未发生变化');
    }

    // 每次条件调整形成新版本，之前的审批结论作废
    const nextVersion = offer.version + 1;
    await this.prisma.offer.update({
      where: { id },
      data: {
        salary: nextSalary,
        startDate: nextStartDate,
        version: nextVersion,
        approvedVersion: null,
        approverId: null,
        status: OfferStatus.PENDING_APPROVAL,
      },
      include: offerInclude,
    });
    await this.prisma.offerApproval.create({
      data: {
        offerId: id,
        version: nextVersion,
        decision: 'SUBMITTED',
        salary: nextSalary,
        startDate: nextStartDate,
        reason: '条件调整，重新提交审批',
        actorId: userId,
        assignedApproverId: offer.assignedApproverId,
      },
    });
    return {
      ...(await this.reload(id)),
      beforeStatus: offer.status,
      candidateId: offer.candidateId,
    };
  }

  /** 招聘经理审批：通过或拒绝，拒绝必须填写原因；只能处理分配给自己的 Offer */
  async decide(
    id: number,
    user: { sub: number; role: string },
    decision: 'APPROVED' | 'REJECTED',
    reason?: string,
  ) {
    const offer = await this.getOrThrow(id);
    if (user.role !== 'ADMIN' && offer.assignedApproverId !== user.sub) {
      throw new ForbiddenException('只能处理分配给自己的 Offer');
    }
    if (offer.status !== OfferStatus.PENDING_APPROVAL) {
      throw new BadRequestException(`当前状态（${offer.status}）不允许审批`);
    }
    if (decision === 'REJECTED' && !reason?.trim()) {
      throw new BadRequestException('拒绝时必须填写原因');
    }
    const nextStatus = decision === 'APPROVED' ? OfferStatus.APPROVED : OfferStatus.REJECTED;
    await this.prisma.offer.update({
      where: { id },
      data: {
        status: nextStatus,
        approverId: user.sub,
        approvedVersion: decision === 'APPROVED' ? offer.version : null,
      },
    });
    await this.prisma.offerApproval.create({
      data: {
        offerId: id,
        version: offer.version,
        decision,
        salary: offer.salary,
        startDate: offer.startDate,
        reason: reason?.trim() || null,
        actorId: user.sub,
        assignedApproverId: offer.assignedApproverId,
      },
    });
    return {
      ...(await this.reload(id)),
      beforeStatus: offer.status,
      candidateId: offer.candidateId,
    };
  }

  /** 发送 Offer：只有当前版本通过审批、且尚未发送时才能发送，旧审批不能用来发送 */
  async send(id: number) {
    const offer = await this.getOrThrow(id);
    if (offer.sentAt) throw new BadRequestException('该录用通知已经发送，不能重复发送');
    if (offer.status !== OfferStatus.APPROVED) {
      throw new BadRequestException('只有审批通过的 Offer 才能发送');
    }
    if (offer.approvedVersion !== offer.version) {
      throw new BadRequestException('审批基于旧版本条件，条件已变更，请重新提交审批');
    }
    await this.prisma.offer.update({
      where: { id },
      data: { status: OfferStatus.SENT, sentAt: new Date() },
    });
    return {
      ...(await this.reload(id)),
      beforeStatus: offer.status,
      candidateId: offer.candidateId,
    };
  }

  /** 发送后的候选人侧流转：接受 / 拒绝 / 撤回 */
  async updateStatus(id: number, status: OfferStatus, reason?: string) {
    const offer = await this.getOrThrow(id);
    const allowed: Record<OfferStatus, OfferStatus[]> = {
      [OfferStatus.SENT]: [OfferStatus.ACCEPTED, OfferStatus.REJECTED, OfferStatus.WITHDRAWN],
      [OfferStatus.DRAFT]: [],
      [OfferStatus.PENDING_APPROVAL]: [],
      [OfferStatus.APPROVED]: [],
      [OfferStatus.ACCEPTED]: [],
      [OfferStatus.REJECTED]: [],
      [OfferStatus.WITHDRAWN]: [],
    };
    if (!allowed[offer.status as OfferStatus].includes(status)) {
      throw new BadRequestException(`Invalid Offer status transition: ${offer.status} -> ${status}`);
    }
    await this.prisma.offer.update({ where: { id }, data: { status } });
    return {
      ...(await this.reload(id)),
      beforeStatus: offer.status,
      reason,
      candidateId: offer.candidateId,
    };
  }

  private getOrThrow(id: number) {
    return this.prisma.offer.findUniqueOrThrow({ where: { id } }).catch(() => {
      throw new NotFoundException('Offer not found');
    });
  }

  private reload(id: number) {
    return this.prisma.offer.findUniqueOrThrow({ where: { id }, include: offerInclude });
  }
}
