import { OfferApprovalDecision, OfferStatus } from '../constants/enums';

declare global {
  interface OfferApproval {
    id: number;
    offerId: number;
    version: number;
    decision: OfferApprovalDecision;
    salary: string;
    startDate: string;
    reason?: string | null;
    actorId?: number | null;
    actor?: User;
    createdAt: string;
  }
  interface Offer {
    id: number;
    candidateId: number;
    jobId: number;
    salary: string;
    startDate: string;
    status: OfferStatus;
    version: number;
    approvedVersion?: number | null;
    assignedApproverId: number;
    approverId?: number | null;
    sentAt?: string | null;
    job?: Job;
    candidate?: Candidate;
    approver?: User;
    assignedApprover?: User;
    approvals?: OfferApproval[];
  }
}
export {};
