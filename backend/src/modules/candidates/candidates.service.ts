import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { publicUserSelect } from '../../prisma/selects';

const offerInclude = {
  job: { include: { hiringManager: { select: publicUserSelect } } },
  approver: { select: publicUserSelect },
  versions: {
    orderBy: { version: 'asc' as const },
    include: { approvals: { include: { actor: { select: publicUserSelect } }, orderBy: { createdAt: 'asc' as const } } },
  },
};

@Injectable()
export class CandidatesService {
  constructor(private prisma: PrismaService) {}
  findAll(q: any) {
    return this.prisma.candidate.findMany({ where: { source: q.source, OR: q.keyword ? [{ name: { contains: q.keyword, mode: 'insensitive' } }, { email: { contains: q.keyword, mode: 'insensitive' } }] : undefined, resumes: { some: { status: q.status, jobId: q.jobId ? Number(q.jobId) : undefined } } }, include: { resumes: { include: { job: true, interviews: true } }, offers: { include: offerInclude } }, orderBy: { updatedAt: 'desc' } });
  }
  findOne(id: number) { return this.prisma.candidate.findUnique({ where: { id }, include: { resumes: { include: { job: true, interviews: { include: { interviewer: { select: publicUserSelect } } } } }, offers: { include: offerInclude } } }); }
  resumes(id: number) { return this.prisma.resume.findMany({ where: { candidateId: id }, include: { job: true, interviews: true } }); }
  interviews(id: number) { return this.prisma.interview.findMany({ where: { resume: { candidateId: id } }, include: { resume: { include: { job: true } }, interviewer: { select: publicUserSelect } } }); }
  offers(id: number) { return this.prisma.offer.findMany({ where: { candidateId: id }, include: offerInclude, orderBy: { updatedAt: 'desc' } }); }
}
