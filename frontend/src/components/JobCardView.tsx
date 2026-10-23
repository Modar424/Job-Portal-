import { Link } from 'react-router-dom';
import type { JobCard } from '../types';
import { formatSalary, label, timeAgo } from '../utils';
import { Avatar, Pill } from './ui';

export function JobCardView({ job }: { job: JobCard }) {
  return (
    <Link to={`/jobs/${job.id}`} className={`group block rounded-xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${job.featured ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200 hover:border-brand-500'}`}>
      <div className="flex items-start gap-4">
        <Avatar name={job.companyName} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="truncate text-base font-semibold text-slate-900 group-hover:text-brand-700">{job.title}</h3>
            <span className="shrink-0 text-xs text-slate-400">{timeAgo(job.createdAt)}</span>
          </div>
          <p className="text-sm text-slate-600">{job.companyName} · {job.location}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {job.featured && <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">★ Featured</span>}
        <Pill>{label(job.employmentType)}</Pill>
        <Pill>{label(job.experienceLevel)}</Pill>
        {job.skills.slice(0, 3).map((s) => <span key={s} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{s}</span>)}
        <span className="ml-auto text-sm font-semibold text-slate-800">{formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency)}</span>
      </div>
    </Link>
  );
}
