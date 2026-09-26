import { OfferApprovalDecision, OfferStatus } from '../constants/enums';

declare global {
  interface OfferApproval {
    id: number;
    offerId: number;
    versionId: number;
    decision: OfferApprovalDecision;
    reason?: string | null;
    actorId?: number | null;
    actor?: User;
    createdAt: string;
  }

  interface OfferVersion {
    id: number;
    offerId: number;
    version: number;
    salary: string;
    startDate: string;
    createdById?: number | null;
    createdAt: string;
    approvals?: OfferApproval[];
  }

  interface Offer {
    id: number;
    candidateId: number;
    jobId: number;
    salary: string;
    startDate: string;
    status: OfferStatus;
    approverId?: number | null;
    version: number;
    approvedVersion?: number | null;
    sentAt?: string | null;
    createdAt: string;
    updatedAt: string;
    job?: Job;
    candidate?: Candidate;
    approver?: User;
    versions?: OfferVersion[];
  }
}
export {};
