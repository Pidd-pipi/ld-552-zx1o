import { JobStatus } from '../constants/enums';
declare global { interface Job { id: number; title: string; department: string; location: string; salaryRange: string; description: string; requirements: string; headcount: number; status: JobStatus; hiringManagerId: number; hiringManager?: User; resumes?: Resume[]; offers?: Offer[]; _count?: { resumes: number; offers: number }; } }
export {};
