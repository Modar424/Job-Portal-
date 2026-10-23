export const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'internship', 'remote'] as const;
export const EXPERIENCE_LEVELS = ['entry', 'mid', 'senior', 'lead'] as const;
export const JOB_STATUSES = ['draft', 'active', 'closed'] as const;
export const APP_STATUSES = [
  'pending', 'under_review', 'shortlisted', 'interview', 'accepted', 'rejected', 'withdrawn',
] as const;

export type AppStatus = (typeof APP_STATUSES)[number];

export const JOB_TRANSITIONS: Record<string, string[]> = {
  draft: ['active'],
  active: ['closed'],
  closed: ['active'],
};

export const EMPLOYER_APP_TRANSITIONS: Record<string, string[]> = {
  pending: ['under_review', 'shortlisted', 'rejected'],
  under_review: ['shortlisted', 'interview', 'rejected'],
  shortlisted: ['interview', 'accepted', 'rejected'],
  interview: ['shortlisted', 'accepted', 'rejected'],
  accepted: [],
  rejected: [],
  withdrawn: [],
};

export const WITHDRAWABLE = ['pending', 'under_review', 'shortlisted', 'interview'];

export const canTransition = (map: Record<string, string[]>, from: string, to: string) =>
  (map[from] ?? []).includes(to);
