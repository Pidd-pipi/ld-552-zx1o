import { PrismaClient, JobStatus, ResumeStatus, InterviewResult, InterviewType, OfferStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
async function main() {
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    console.log('TalentFlow seed skipped: database already has users.');
    return;
  }
  await prisma.auditLog.deleteMany();
  await prisma.offerApproval.deleteMany();
  await prisma.offerVersion.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.interview.deleteMany();
  await prisma.resume.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.job.deleteMany();
  await prisma.user.deleteMany();
  const passwordHash = await bcrypt.hash('talentflow123', 10);
  const [admin, hr, manager, interviewer] = await Promise.all([
    prisma.user.create({ data: { name: '系统管理员', email: 'admin@talentflow.local', passwordHash, role: UserRole.ADMIN } }),
    prisma.user.create({ data: { name: '林晓 HR', email: 'hr@talentflow.local', passwordHash, role: UserRole.HR, department: '产品研发部' } }),
    prisma.user.create({ data: { name: '周远 招聘经理', email: 'manager@talentflow.local', passwordHash, role: UserRole.HIRING_MANAGER, department: '产品研发部' } }),
    prisma.user.create({ data: { name: '陈北 面试官', email: 'interviewer@talentflow.local', passwordHash, role: UserRole.INTERVIEWER, department: '产品研发部' } }),
  ]);
  const job1 = await prisma.job.create({ data: { title: '高级前端工程师', department: '产品研发部', location: '上海 / 远程混合', salaryRange: '30k-45k', description: '负责 TalentFlow 核心招聘协作体验与数据可视化。', requirements: 'React、TypeScript、复杂业务系统经验，关注工程质量。', headcount: 3, status: JobStatus.OPEN, hiringManagerId: manager.id } });
  const job2 = await prisma.job.create({ data: { title: '后端平台工程师', department: '产品研发部', location: '杭州', salaryRange: '28k-42k', description: '建设招聘流程服务、权限与审计能力。', requirements: 'NestJS/Node.js、PostgreSQL、Prisma、领域建模经验。', headcount: 2, status: JobStatus.PAUSED, hiringManagerId: manager.id } });
  const c1 = await prisma.candidate.create({ data: { name: '许晨', email: 'chen.xu@example.com', phone: '13800000001', source: '内推' } });
  const c2 = await prisma.candidate.create({ data: { name: '王一宁', email: 'yining.wang@example.com', phone: '13800000002', source: '招聘平台' } });
  const r1 = await prisma.resume.create({ data: { candidateId: c1.id, jobId: job1.id, resumeUrl: 'https://files.example.com/resumes/xuchen.pdf', coverLetter: '希望加入高质量工程团队。', status: ResumeStatus.INTERVIEWING } });
  const r2 = await prisma.resume.create({ data: { candidateId: c2.id, jobId: job1.id, resumeUrl: 'https://files.example.com/resumes/wangyining.pdf', status: ResumeStatus.SCREENING } });
  await prisma.interview.create({ data: { resumeId: r1.id, interviewerId: interviewer.id, round: 1, scheduledAt: new Date(Date.now() + 86400000), duration: 60, type: InterviewType.TECHNICAL, result: InterviewResult.PENDING, notes: '重点考察组件架构与状态管理。' } });

  // Offer 1：条件被调整过的待审批 Offer（v1 已拒绝，v2 等待招聘经理审批）
  const offer1 = await prisma.offer.create({ data: { candidateId: c1.id, jobId: job1.id, salary: '45000', startDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), status: OfferStatus.PENDING_APPROVAL, approverId: manager.id, version: 2 } });
  const ov1v1 = await prisma.offerVersion.create({ data: { offerId: offer1.id, version: 1, salary: '42000', startDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 45), createdById: hr.id } });
  await prisma.offerApproval.create({ data: { offerId: offer1.id, versionId: ov1v1.id, decision: 'SUBMITTED', actorId: hr.id } });
  await prisma.offerApproval.create({ data: { offerId: offer1.id, versionId: ov1v1.id, decision: 'REJECTED', reason: '薪资超出该职级带宽，请下调后重新提交。', actorId: manager.id } });
  const ov1v2 = await prisma.offerVersion.create({ data: { offerId: offer1.id, version: 2, salary: '45000', startDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), createdById: hr.id } });
  await prisma.offerApproval.create({ data: { offerId: offer1.id, versionId: ov1v2.id, decision: 'SUBMITTED', actorId: hr.id } });

  // Offer 2：审批通过、等待发送的 Offer（审批版本与当前版本一致）
  const offer2 = await prisma.offer.create({ data: { candidateId: c2.id, jobId: job1.id, salary: '36000', startDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 35), status: OfferStatus.APPROVED, approverId: manager.id, version: 1, approvedVersion: 1 } });
  const ov2v1 = await prisma.offerVersion.create({ data: { offerId: offer2.id, version: 1, salary: '36000', startDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 35), createdById: hr.id } });
  await prisma.offerApproval.create({ data: { offerId: offer2.id, versionId: ov2v1.id, decision: 'SUBMITTED', actorId: hr.id } });
  await prisma.offerApproval.create({ data: { offerId: offer2.id, versionId: ov2v1.id, decision: 'APPROVED', actorId: manager.id } });

  await prisma.auditLog.create({ data: { actorId: hr.id, action: 'Resume_STATUS_CHANGE', entity: 'Resume', entityId: r1.id, beforeStatus: 'SHORTLISTED', afterStatus: 'INTERVIEWING', reason: '通过电话初筛', ipAddress: '127.0.0.1', candidateId: c1.id } });
  await prisma.auditLog.createMany({ data: [
    { actorId: hr.id, action: 'Offer_STATUS_CHANGE', entity: 'Offer', entityId: offer1.id, beforeStatus: 'DRAFT', afterStatus: 'PENDING_APPROVAL', ipAddress: '127.0.0.1', candidateId: c1.id },
    { actorId: manager.id, action: 'Offer_STATUS_CHANGE', entity: 'Offer', entityId: offer1.id, beforeStatus: 'PENDING_APPROVAL', afterStatus: 'REJECTED', reason: '薪资超出该职级带宽，请下调后重新提交。', ipAddress: '127.0.0.1', candidateId: c1.id },
    { actorId: hr.id, action: 'Offer_STATUS_CHANGE', entity: 'Offer', entityId: offer1.id, beforeStatus: 'REJECTED', afterStatus: 'PENDING_APPROVAL', reason: '调整薪资与入职日期后重新提交', ipAddress: '127.0.0.1', candidateId: c1.id },
    { actorId: hr.id, action: 'Offer_STATUS_CHANGE', entity: 'Offer', entityId: offer2.id, beforeStatus: 'DRAFT', afterStatus: 'PENDING_APPROVAL', ipAddress: '127.0.0.1', candidateId: c2.id },
    { actorId: manager.id, action: 'Offer_STATUS_CHANGE', entity: 'Offer', entityId: offer2.id, beforeStatus: 'PENDING_APPROVAL', afterStatus: 'APPROVED', ipAddress: '127.0.0.1', candidateId: c2.id },
  ] });
  console.log({ admin: admin.email, hr: hr.email, manager: manager.email, interviewer: interviewer.email, password: 'talentflow123' });
}
main().finally(() => prisma.$disconnect());
