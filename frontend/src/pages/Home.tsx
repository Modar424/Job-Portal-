import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { JobCardView } from '../components/JobCardView';
import { ErrorBox, JobCardSkeleton, useFetch } from '../components/ui';
import type { Category, JobCard } from '../types';

const POPULAR = ['React', 'Node.js', 'Design', 'Marketing', 'Data', 'Remote'];

export default function Home() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [loc, setLoc] = useState('');
  const latest = useFetch(() => api.list<JobCard>('/jobs?pageSize=6'), []);
  const cats = useFetch(() => api.get<Category[]>('/jobs/categories'), []);
  const stats = useFetch(() => api.get<{ activeJobs: number; companies: number; candidates: number }>('/jobs/stats'), []);
  const go = (e: React.FormEvent) => { e.preventDefault(); nav(`/jobs?${new URLSearchParams({ ...(q && { q }), ...(loc && { location: loc }) })}`); };
  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 text-white">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-accent-500/20 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium tracking-wide">The smarter way to hire and get hired</span>
          <h1 className="mt-5 max-w-3xl text-4xl font-extrabold leading-tight sm:text-6xl">Find work you'll love. Hire people who'll thrive.</h1>
          <p className="mt-4 max-w-xl text-lg text-brand-100">Search thousands of roles, apply in minutes and follow every step of your application.</p>
          <form role="search" onSubmit={go} className="mt-8 grid max-w-3xl gap-2 rounded-2xl bg-white p-2 shadow-2xl sm:grid-cols-[1fr_1fr_auto]">
            <label className="sr-only" htmlFor="hq">Job title or keyword</label>
            <input id="hq" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Job title, skill or company" className="rounded-xl px-4 py-3 text-slate-800 placeholder:text-slate-400" />
            <label className="sr-only" htmlFor="hl">Location</label>
            <input id="hl" value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="City or country" className="rounded-xl px-4 py-3 text-slate-800 placeholder:text-slate-400" />
            <button className="rounded-xl bg-accent-600 px-6 py-3 font-semibold text-white hover:bg-accent-500">Search jobs</button>
          </form>
          <p className="mt-4 text-sm text-brand-100">Popular: {POPULAR.map((p, i) => <span key={p}><Link className="underline-offset-2 hover:underline" to={`/jobs?q=${encodeURIComponent(p)}`}>{p}</Link>{i < POPULAR.length - 1 ? ' · ' : ''}</span>)}</p>
        </div>
      </section>

      <section aria-label="Platform statistics" className="border-b bg-white">
        <dl className="mx-auto grid max-w-6xl grid-cols-3 divide-x px-4 py-6 text-center">
          {[['Open jobs', stats.data?.activeJobs], ['Companies', stats.data?.companies], ['Candidates', stats.data?.candidates]].map(([l, v]) => (
            <div key={l as string}><dd className="text-2xl font-bold text-brand-700 sm:text-3xl">{v ?? '–'}</dd><dt className="text-xs text-slate-500 sm:text-sm">{l}</dt></div>
          ))}
        </dl>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="mb-6 flex items-end justify-between">
          <div><h2 className="text-2xl font-bold">Latest opportunities</h2><p className="text-sm text-slate-500">Fresh roles from growing companies</p></div>
          <Link to="/jobs" className="text-sm font-medium text-brand-600 hover:underline">View all jobs →</Link>
        </div>
        {latest.loading ? <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <JobCardSkeleton key={i} />)}</div>
          : latest.error ? <ErrorBox message={latest.error} onRetry={latest.reload} />
          : latest.data!.data.length === 0 ? <p className="text-slate-500">No jobs published yet. Check back soon.</p>
          : <div className="grid gap-4 md:grid-cols-2">{latest.data!.data.map((j) => <JobCardView key={j.id} job={j} />)}</div>}
      </section>

      <section className="bg-white py-14">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-6 text-2xl font-bold">Browse by category</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {cats.data?.map((c) => (
              <Link key={c.id} to={`/jobs?categoryId=${c.id}`} className="rounded-xl border border-slate-200 px-4 py-5 text-center text-sm font-medium transition hover:-translate-y-0.5 hover:border-brand-500 hover:bg-brand-50 hover:shadow-sm">{c.name}</Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="mb-8 text-center text-2xl font-bold">How it works</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {[['1', 'Create your profile', 'Add your details and resume once, reuse them for every application.'],
            ['2', 'Apply in minutes', 'Search by keyword, skill or location, then apply with an optional cover letter.'],
            ['3', 'Track every step', 'Follow your application from review to interview to offer, with email updates.']].map(([n, t, d]) => (
            <div key={n} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700">{n}</span>
              <h3 className="mt-4 font-semibold">{t}</h3><p className="mt-1 text-sm text-slate-600">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gradient-to-r from-brand-900 to-brand-700 py-14 text-center text-white">
        <h2 className="text-2xl font-bold">Hiring? Reach qualified candidates today.</h2>
        <p className="mt-2 text-brand-100">Publish listings, rate and review applicants, and track performance with analytics.</p>
        <Link to="/register?role=employer" className="mt-6 inline-block rounded-lg bg-white px-6 py-3 font-semibold text-brand-700 shadow hover:bg-brand-50">Post a job</Link>
      </section>
    </>
  );
}
