import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, qs } from '../api';
import { JobCardView } from '../components/JobCardView';
import { Button, EmptyState, ErrorBox, JobCardSkeleton, Pagination, Select, TextField, useFetch } from '../components/ui';
import type { Category, JobCard } from '../types';
import { label } from '../utils';

const KEYS = ['q', 'location', 'categoryId', 'type', 'level', 'skill', 'salaryMin', 'sort'] as const;

export default function Jobs() {
  const [sp, setSp] = useSearchParams();
  const get = (k: string) => sp.get(k) ?? '';
  const [form, setForm] = useState<Record<string, string>>(() => Object.fromEntries(KEYS.map((k) => [k, get(k)])));
  const [showFilters, setShowFilters] = useState(false);
  useEffect(() => { setForm(Object.fromEntries(KEYS.map((k) => [k, sp.get(k) ?? '']))); }, [sp]);
  const page = Math.max(1, Number(get('page')) || 1);
  const cats = useFetch(() => api.get<Category[]>('/jobs/categories'), []);
  const skills = useFetch(() => api.get<string[]>('/jobs/skills'), []);
  const query = qs({ ...Object.fromEntries(KEYS.map((k) => [k, get(k)])), page, pageSize: 10 });
  const res = useFetch(() => api.list<JobCard>(`/jobs${query}`), [query]);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = new URLSearchParams();
    KEYS.forEach((k) => form[k] && n.set(k, form[k]));
    setSp(n); setShowFilters(false);
  };
  const remove = (k: string) => { const n = new URLSearchParams(sp); n.delete(k); n.delete('page'); setSp(n); };
  const active = KEYS.filter((k) => k !== 'sort' && get(k));
  const chipText = (k: string) => {
    const v = get(k);
    if (k === 'categoryId') return cats.data?.find((c) => String(c.id) === v)?.name ?? 'Category';
    if (k === 'type' || k === 'level') return label(v);
    if (k === 'salaryMin') return `Min ${Number(v).toLocaleString()}`;
    return v;
  };
  const meta = res.data?.meta;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-end justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Find your next job</h1>{meta && !res.loading && <p className="text-sm text-slate-500">{meta.total.toLocaleString()} {meta.total === 1 ? 'job' : 'jobs'} found</p>}</div>
        <Button variant="secondary" className="lg:hidden" onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters}>Filters{active.length ? ` (${active.length})` : ''}</Button>
      </div>
      {active.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Active filters">
          {active.map((k) => <li key={k}><button onClick={() => remove(k)} aria-label={`Remove filter ${chipText(k)}`} className="flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-700 hover:bg-brand-100">{chipText(k)} <span aria-hidden="true">✕</span></button></li>)}
        </ul>
      )}
      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        <form onSubmit={submit} className={`h-fit space-y-4 rounded-xl border border-slate-200 bg-white p-5 lg:sticky lg:top-20 lg:block ${showFilters ? 'block' : 'hidden'}`} aria-label="Job filters">
          <TextField label="Keyword" value={form.q} onChange={set('q')} placeholder="Title, company, skill" />
          <TextField label="Location" value={form.location} onChange={set('location')} placeholder="City or country" />
          <Select label="Category" value={form.categoryId} onChange={set('categoryId')}><option value="">All categories</option>{cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          <Select label="Employment type" value={form.type} onChange={set('type')}>
            <option value="">Any</option><option value="full_time">Full-time</option><option value="part_time">Part-time</option><option value="contract">Contract</option><option value="internship">Internship</option><option value="remote">Remote</option>
          </Select>
          <Select label="Experience level" value={form.level} onChange={set('level')}><option value="">Any</option><option value="entry">Entry level</option><option value="mid">Mid level</option><option value="senior">Senior</option><option value="lead">Lead</option></Select>
          <div>
            <TextField label="Skill" list="skill-list" value={form.skill} onChange={set('skill')} placeholder="e.g. React" />
            <datalist id="skill-list">{skills.data?.map((s) => <option key={s} value={s} />)}</datalist>
          </div>
          <TextField label="Minimum salary (yearly)" type="number" min={0} step={1000} value={form.salaryMin} onChange={set('salaryMin')} />
          <Select label="Sort by" value={form.sort} onChange={set('sort')}>
            <option value="">Newest</option><option value="relevance">Most relevant</option><option value="salary_desc">Highest salary</option><option value="salary_asc">Lowest salary</option>
          </Select>
          <div className="flex gap-2"><Button type="submit" className="flex-1">Apply filters</Button>{active.length > 0 && <Button type="button" variant="secondary" onClick={() => setSp(new URLSearchParams())}>Clear</Button>}</div>
        </form>
        <section aria-live="polite" aria-busy={res.loading}>
          {res.loading ? <div className="space-y-3">{Array.from({ length: 5 }, (_, i) => <JobCardSkeleton key={i} />)}</div>
            : res.error ? <ErrorBox message={res.error} onRetry={res.reload} />
            : res.data!.data.length === 0 ? <EmptyState title="No jobs match your search" text="Try removing a filter or searching with different keywords." action={active.length ? <Button onClick={() => setSp(new URLSearchParams())}>Clear filters</Button> : undefined} />
            : <>
              <div className="space-y-3">{res.data!.data.map((j) => <JobCardView key={j.id} job={j} />)}</div>
              {meta && <Pagination page={meta.page} totalPages={meta.totalPages} onChange={(p) => { const n = new URLSearchParams(sp); n.set('page', String(p)); setSp(n); window.scrollTo(0, 0); }} />}
            </>}
        </section>
      </div>
    </div>
  );
}
