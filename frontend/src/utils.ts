export const LABELS: Record<string, string> = {
  full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract', internship: 'Internship', remote: 'Remote',
  entry: 'Entry level', mid: 'Mid level', senior: 'Senior', lead: 'Lead',
  pending: 'Pending', under_review: 'Under review', shortlisted: 'Shortlisted', interview: 'Interview',
  accepted: 'Accepted', rejected: 'Rejected', withdrawn: 'Withdrawn',
  draft: 'Draft', active: 'Active', closed: 'Closed', approved: 'Approved', removed: 'Removed',
  suspended: 'Suspended', seeker: 'Job seeker', employer: 'Employer', admin: 'Administrator',
  spam: 'Spam', scam: 'Scam or fraud', discriminatory: 'Discriminatory', inaccurate: 'Inaccurate information', other: 'Other',
};
export const label = (k: string) => LABELS[k] ?? k;

const SYMBOL: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', SAR: 'SAR ', AED: 'AED ', EGP: 'EGP ' };
export function formatSalary(min: number | null, max: number | null, currency = 'USD') {
  const s = SYMBOL[currency] ?? '$';
  const f = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
  if (min == null && max == null) return 'Salary not disclosed';
  if (min != null && max != null) return `${s}${f(min)} – ${s}${f(max)}`;
  return min != null ? `From ${s}${f(min)}` : `Up to ${s}${f(max!)}`;
}

export function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export const fmtDate = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export const EMPLOYER_NEXT: Record<string, string[]> = {
  pending: ['under_review', 'shortlisted', 'rejected'],
  under_review: ['shortlisted', 'interview', 'rejected'],
  shortlisted: ['interview', 'accepted', 'rejected'],
  interview: ['shortlisted', 'accepted', 'rejected'],
};
export const WITHDRAWABLE = ['pending', 'under_review', 'shortlisted', 'interview'];

export function validateEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
export function validatePassword(v: string): string | null {
  if (v.length < 8) return 'Use at least 8 characters';
  if (!/[A-Za-z]/.test(v) || !/[0-9]/.test(v)) return 'Include at least one letter and one number';
  return null;
}

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'EGP'];
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
export const isoToLocalInput = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');
