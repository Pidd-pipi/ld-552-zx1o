import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { publicUserSelect } from '../../prisma/selects';
import { OfferApprovalDecision, OfferStatus, UserRole } from '../../constants/enums';
import type { CreateOfferDto } from './dto/create-offer.dto';
import type { UpdateOfferDto } from './dto/update-offer.dto';
import type { ReviewOfferDto } from './dto/review-offer.dto';
import type { UpdateOfferStatusDto } from './dto/update-offer-status.dto';
import type { QueryOfferDto } from './dto/query-offer.dto';

// Offer 发出后的状态流转（候选人确认 / HR 撤回）
const sentFlow: Record<string, OfferStatus[]> = {
  [OfferStatus.SENT]: [OfferStatus.ACCEPTED, OfferStatus.REJECTED, OfferStatus.WITHDRAWN],
};

// 一旦已发送给候选人，条件与状态均锁定（候选人回执除外）
const lockedStatuses: OfferStatus[] = [OfferStatus.SENT, OfferStatus.ACCEPTED, OfferStatus.WITHDRAWN];

const offerInclude = {
  candidate: true,
  job: { include: { hiringManager: { select: publicUserSelect } } },
  approver: { select: publicUserSelect },
  versions: {
    orderBy: { version: 'asc' as const },
    include: { approvals: { include: { actor: { select: publicUserSelect } }, orderBy: { createdAt: 'asc' as const } } },
  },
};

type AuthUser = { sub: number; role: UserRole };

function userId(user: AuthUser): number { return Number(user.sub); }

@Injectable()
export class OffersService {
  constructor(private prisma: PrismaService) {}

  findAll(query: QueryOfferDto, user: AuthUser) {
    const where: any = { status: query.status, candidateId: query.candidateId };
    // 招聘经理只能看到分配给自己（职位招聘经理是本人）的 Offer
    if (user.role === UserRole.HIRING_MANAGER) where.job = { hiringManagerId: userId(user) };
    return this.prisma.offer.findMany({ where, include: offerInclude, orderBy: { updatedAt: 'desc' } });
  }

  async findOne(id: number, user?: AuthUser) {
    const offer = await this.prisma.offer.findUnique({ where: { id }, include: offerInclude });
    if (!offer) throw new NotFoundException('Offer not found');
    // 招聘经理仅可查看分配给自己的 Offer 详情
    if (user && user.role === UserRole.HIRING_MANAGER && offer.job.hiringManagerId !== userId(user)) {
      throw new ForbiddenException('只能查看分配给自己的 Offer');
    }
    return offer;
  }

  // HR 创建 Offer：默认草稿；submit=true 创建后直接提交审批（生成 v1 条件快照）
  async create(dto: CreateOfferDto, user: AuthUser) {
    const [job, candidate] = await Promise.all([
      this.prisma.job.findUnique({ where: { id: dto.jobId }, select: { id: true } }),
      this.prisma.candidate.findUnique({ where: { id: dto.candidateId }, select: { id: true } }),
    ]);
    if (!job) throw new NotFoundException('Job not found');
    if (!candidate) throw new NotFoundException('Candidate not found');
    const salary = String(dto.salary);
    const startDate = this.parseStartDate(dto.startDate);

    if (!dto.submit) {
      return this.prisma.offer.create({
        data: { candidateId: dto.candidateId, jobId: dto.jobId, salary, startDate, status: OfferStatus.DRAFT, version: 1 },
        include: offerInclude,
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const offer = await tx.offer.create({
        data: { candidateId: dto.candidateId, jobId: dto.jobId, salary, startDate, status: OfferStatus.PENDING_APPROVAL, version: 1 },
      });
      const version = await tx.offerVersion.create({
        data: { offerId: offer.id, version: 1, salary, startDate, createdById: userId(user) },
      });
      await tx.offerApproval.create({
        data: { offerId: offer.id, versionId: version.id, decision: OfferApprovalDecision.SUBMITTED, actorId: userId(user) },
      });
      return tx.offer.findUniqueOrThrow({ where: { id: offer.id }, include: offerInclude });
    });
  }

  // HR 调整条件：已发送锁定不可改；审批通过后改动 -> 新版本回到待审批，旧审批失效
  async update(id: number, dto: UpdateOfferDto, user: AuthUser) {
    const offer = await this.requireOffer(id);
    this.assertEditable(offer);

    const salary = dto.salary !== undefined ? String(dto.salary) : offer.salary;
    const startDate = dto.startDate !== undefined ? this.parseStartDate(dto.startDate) : offer.startDate;
    const changed = Number(salary) !== Number(offer.salary) || startDate.getTime() !== offer.startDate.getTime();

    // 草稿阶段仅落字段，版本快照在首次提交时生成
    if (offer.status === OfferStatus.DRAFT && !dto.submit) {
      return this.prisma.offer.update({ where: { id }, data: { salary, startDate }, include: offerInclude });
    }

    // 审批通过后仅条件改动才回到待审批；待审批中无改动不重复提交；拒绝后原条件重新提交走 submit 接口
    if (!changed && offer.status !== OfferStatus.DRAFT && offer.status !== OfferStatus.REJECTED) {
      return this.findOne(id);
    }
    if (!changed && offer.status === OfferStatus.REJECTED && !dto.submit) {
      return this.findOne(id);
    }

    // 待审批中调整：新版本重新等待审批（无状态跳转，仅旧版本失效）
    // 审批通过后调整：新版本回到待审批
    // 审批拒绝（发送前）后调整：作为新一轮条件重新提交
    return this.prisma.$transaction(async (tx) => {
      const before = offer.status;
      const next = await this.applySubmittedConditions(tx, offer, salary, startDate, changed, user);
      const updated = await tx.offer.update({
        where: { id },
        data: { salary, startDate, status: OfferStatus.PENDING_APPROVAL, version: next.version, approvedVersion: null },
        include: offerInclude,
      });
      return { ...updated, beforeStatus: before, candidateId: offer.candidateId };
    });
  }

  // HR 提交审批：草稿首次提交；审批拒绝（发送前）可重新提交
  async submit(id: number, user: AuthUser) {
    const offer = await this.requireOffer(id);
    this.assertEditable(offer);
    if (offer.status === OfferStatus.PENDING_APPROVAL) throw new BadRequestException('Offer 已在待审批中');
    if (offer.status === OfferStatus.APPROVED) throw new BadRequestException('Offer 已审批通过，无需重复提交');

    return this.prisma.$transaction(async (tx) => {
      const before = offer.status;
      const next = await this.applySubmittedConditions(tx, offer, offer.salary, offer.startDate, false, user);
      const updated = await tx.offer.update({
        where: { id },
        data: { status: OfferStatus.PENDING_APPROVAL, version: next.version, approvedVersion: null },
        include: offerInclude,
      });
      return { ...updated, beforeStatus: before, candidateId: offer.candidateId };
    });
  }

  // 招聘经理审批：只能处理分配给自己的 Offer；拒绝必须写明原因
  async review(id: number, dto: ReviewOfferDto, user: AuthUser) {
    const offer = await this.prisma.offer.findUnique({ where: { id }, include: { job: true } });
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.status !== OfferStatus.PENDING_APPROVAL) {
      throw new BadRequestException(`当前状态（${offer.status}）不可审批，仅待审批 Offer 可处理`);
    }
    if (user.role !== UserRole.ADMIN && offer.job.hiringManagerId !== userId(user)) {
      throw new ForbiddenException('只能审批分配给自己的 Offer');
    }
    if (dto.decision === OfferApprovalDecision.REJECTED && !dto.reason?.trim()) {
      throw new BadRequestException('拒绝时必须写明原因');
    }
    const latestVersion = await this.prisma.offerVersion.findFirst({
      where: { offerId: id }, orderBy: { version: 'desc' },
    });
    if (!latestVersion) throw new BadRequestException('缺少审批条件版本');

    const approved = dto.decision === OfferApprovalDecision.APPROVED;
    await this.prisma.$transaction(async (tx) => {
      await tx.offerApproval.create({
        data: { offerId: id, versionId: latestVersion.id, decision: dto.decision, reason: dto.reason?.trim() || null, actorId: userId(user) },
      });
      await tx.offer.update({
        where: { id },
        data: approved
          ? { status: OfferStatus.APPROVED, approverId: userId(user), approvedVersion: offer.version }
          : { status: OfferStatus.REJECTED, approverId: userId(user) },
      });
    });
    const updated = await this.findOne(id);
    return { ...updated, beforeStatus: OfferStatus.PENDING_APPROVAL, reason: dto.reason, candidateId: offer.candidateId };
  }

  // HR 发送 Offer：仅审批通过且审批对应当前版本时才能发送
  async send(id: number) {
    const offer = await this.requireOffer(id);
    if (offer.status !== OfferStatus.APPROVED) {
      throw new BadRequestException('只有审批通过的 Offer 才能发送');
    }
    if (offer.approvedVersion !== offer.version) {
      throw new BadRequestException('审批对应的条件已变更，旧审批不能用于发送，请重新提交审批');
    }
    const updated = await this.prisma.offer.update({
      where: { id },
      data: { status: OfferStatus.SENT, sentAt: new Date() },
      include: offerInclude,
    });
    return { ...updated, beforeStatus: OfferStatus.APPROVED, candidateId: offer.candidateId };
  }

  // 发送后的候选人回执 / 撤回：SENT -> ACCEPTED / REJECTED / WITHDRAWN
  async updateStatus(id: number, dto: UpdateOfferStatusDto) {
    const offer = await this.requireOffer(id);
    if (!sentFlow[offer.status]?.includes(dto.status)) {
      throw new BadRequestException(`Invalid Offer status transition: ${offer.status} -> ${dto.status}`);
    }
    const updated = await this.prisma.offer.update({ where: { id }, data: { status: dto.status }, include: offerInclude });
    return { ...updated, beforeStatus: offer.status, reason: dto.reason, candidateId: offer.candidateId };
  }

  private async requireOffer(id: number) {
    const offer = await this.prisma.offer.findUnique({ where: { id } });
    if (!offer) throw new NotFoundException('Offer not found');
    return offer;
  }

  private assertEditable(offer: { status: string; sentAt: Date | null }) {
    if (offer.sentAt || (lockedStatuses as string[]).includes(offer.status)) {
      throw new BadRequestException('已发送的录用通知不能再编辑');
    }
  }

  private parseStartDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid startDate');
    return date;
  }

  // 落条件快照 + SUBMITTED 审批记录：
  // 草稿首次提交生成 v1；其后条件变更升版本，旧版本审批保留但不再代表当前条件。
  private async applySubmittedConditions(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    offer: { id: number; version: number },
    salary: string | { toString(): string },
    startDate: Date,
    changed: boolean,
    user: AuthUser,
  ) {
    const versionCount = await tx.offerVersion.count({ where: { offerId: offer.id } });
    let versionId: number;
    let version = offer.version;
    if (versionCount === 0) {
      // 草稿首次提交
      version = 1;
      versionId = (await tx.offerVersion.create({
        data: { offerId: offer.id, version: 1, salary: String(salary), startDate, createdById: userId(user) },
      })).id;
    } else if (changed) {
      // 条件调整：升新版本，旧版本上的审批自动失效
      version = offer.version + 1;
      versionId = (await tx.offerVersion.create({
        data: { offerId: offer.id, version, salary: String(salary), startDate, createdById: userId(user) },
      })).id;
    } else {
      // 条件未变（如拒绝后原条件重新提交）：沿用当前版本
      versionId = (await tx.offerVersion.findFirstOrThrow({
        where: { offerId: offer.id }, orderBy: { version: 'desc' },
      })).id;
    }
    await tx.offerApproval.create({
      data: { offerId: offer.id, versionId, decision: OfferApprovalDecision.SUBMITTED, actorId: userId(user) },
    });
    return { version, versionId };
  }
}
