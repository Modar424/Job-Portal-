import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { JobCardView } from '../components/JobCardView';
import { Avatar, EmptyState, ErrorBox, PageLoader, Pill, useFetch } from '../components/ui';
import type { JobCard } from '../types';

interface Company { id: number; name: string; description: string | null; website: string | null; location: string | null; industry: string | null; size: string | null; jobs: JobCard[] }

export default function CompanyPage() {
  const { id } = useParams();
  const { data: c, loading, error, reload } = useFetch(() => api.get<Company>(`/companies/${id}`), [id]);
  if (loading) return <PageLoader />;
  if (error || !c) return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorBox message={error ?? 'Company not found'} onRetry={reload} /><Link to="/jobs" className="mt-4 inline-block text-brand-600">← Back to jobs</Link></div>;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-center">
        <Avatar name={c.name} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{c.name}</h1>
          <div className="mt-2 flex flex-wrap gap-2">{c.industry && <Pill>{c.industry}</Pill>}{c.size && <Pill>{c.size} employees</Pill>}{c.location && <Pill>{c.location}</Pill>}</div>
        </div>
        {c.website && <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-brand-600 hover:underline">Visit website ↗</a>}
      </header>
      {c.description && <section className="mt-8"><h2 className="text-lg font-semibold">About us</h2><p className="mt-2 max-w-3xl whitespace-pre-line leading-relaxed text-slate-700">{c.description}</p></section>}
      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold">Open positions ({c.jobs.length})</h2>
        {c.jobs.length === 0 ? <EmptyState title="No open positions right now" text="Check back soon." /> : <div className="grid gap-4 md:grid-cols-2">{c.jobs.map((j) => <JobCardView key={j.id} job={j} />)}</div>}
      </section>
    </div>
  );
}
