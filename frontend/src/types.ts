export type Role = 'seeker' | 'employer' | 'admin';
export interface User { id: number; email: string; fullName: string; role: Role; emailVerified: boolean }
export interface Meta { page: number; pageSize: number; total: number; totalPages: number }
export interface JobCard {
  id: number; title: string; location: string; salaryMin: number | null; salaryMax: number | null; salaryCurrency: string;
  employmentType: string; experienceLevel: string; status: string; featured: boolean; views: number; expiresAt: string | null;
  createdAt: string; companyId: number; companyName: string; category: string | null; skills: string[];
}
export interface Category { id: number; name: string }
export interface DayPoint { date: string; count: number }
