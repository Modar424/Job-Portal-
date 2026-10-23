import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError, api, qs } from '../api';
import { Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, ErrorBox, LineChart, Modal, PageLoader, Pagination, Select, Skeleton, StatCard, Stars, Tabs, TextArea, TextField, useFetch, useToast } from '../components/ui';
import type { Category, DayPoint } from '../types';
import { CURRENCIES, EMPLOYER_NEXT, fmtDate, isoToLocalInput, label, timeAgo } from '../utils';

type Tab = 'overview' | 'jobs' | 'applicants' | 'company';
const TABS: Tab[] = ['overview', 'jobs', 'applicants', 'company'];
const STATUSES = ['pending', 'under_review', 'shortlisted', 'interview', 'accepted', 'rejected', 'withdrawn'];

export default function EmployerDashboard() {
  const [sp, setSp] = useSearchParams();
  const tab = (TABS.includes(sp.get('tab') as Tab) ? sp.get('tab') : 'overview') as Tab;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Employer dashboard</h1>
      <Tabs<Tab> value={tab} onChange={(t) => setSp({ tab: t })} tabs={[{ id: 'overview', label: 'Overview' }, { id: 'jobs', label: 'Job listings' }, { id: 'applicants', label: 'Applicants' }, { id: 'company', label: 'Company profile' }]} />
      {tab === 'overview' && <Overview />}{tab === 'jobs' && <Jobs />}{tab === 'applicants' && <Applicants />}{tab === 'company' && <Company />}
    </div>
  );
}

interface Stats { jobs: Record<string, number>; applications: Record<string, number>; topJobs: { id: number; title: string; status: string; views: number; applications: number }[]; totalViews: number; totalApplications: number; conversionRate: number; applicationsPerDay: DayPoint[] }

function Overview() {
  const r = useFetch(() => api.get<Stats>('/employer/stats'), []);
  if (r.loading) return <div className="space-y-4"><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-56" /></div>;
  if (r.error) return <ErrorBox message={r.error} onRetry={r.reload} />;
  const s = r.data!;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active jobs" value={s.jobs.active ?? 0} /><StatCard label="Listing views" value={s.totalViews.toLocaleString()} />
        <StatCard label="Applications" value={s.totalApplications} /><StatCard label="View → apply rate" value={`${s.conversionRate}%`} />
      </div>
      <Card><h2 className="mb-2 font-semibold">Applications · last 30 days</h2><LineChart data={s.applicationsPerDay} title="Applications per day" /></Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Pipeline</h2>
          <div className="flex flex-wrap gap-2">{STATUSES.map((st) => <span key={st} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-sm"><Badge value={st} /><b>{s.applications[st] ?? 0}</b></span>)}</div>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Top listings</h2>
          {s.topJobs.length === 0 ? <p className="text-sm text-slate-500">No listings yet. Create your first job in “Job listings”.</p> :
            <ul className="divide-y">{s.topJobs.map((j) => <li key={j.id} className="flex items-center justify-between gap-2 py-2 text-sm"><span className="min-w-0 truncate">{j.title} <Badge value={j.status} /></span><span className="shrink-0 text-slate-500">{j.views} views · <b className="text-slate-900">{j.applications}</b> apps</span></li>)}</ul>}
        </Card>
      </div>
    </div>
  );
}

interface JobRow { id: number; title: string; location: string; status: string; moderation: string; views: number; featured: boolean; expiresAt: string | null; createdAt: string; applicationCount: number }
const EMPTY = { title: '', description: '', requirements: '', location: '', categoryId: '', salaryMin: '', salaryMax: '', salaryCurrency: 'USD', employmentType: 'full_time', experienceLevel: 'mid', skills: '', expiresAt: '' };

function Jobs() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [edit, setEdit] = useState<number | 'new' | null>(null);
  const [del, setDel] = useState<JobRow | null>(null);
  const r = useFetch(() => api.list<JobRow>(`/employer/jobs${qs({ page, status, pageSize: 10 })}`), [page, status]);
  const setSt = async (j: JobRow, s: string) => { try { await api.post(`/employer/jobs/${j.id}/status`, { status: s }); toast(`Job ${s === 'active' ? 'published' : 'closed'}`); r.reload(); } catch (e) { toast((e as Error).message, 'err'); } };
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="w-48"><Select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All</option><option value="draft">Draft</option><option value="active">Active</option><option value="closed">Closed</option></Select></div>
        <Button onClick={() => setEdit('new')}>+ New job</Button>
      </div>
      {r.loading ? <PageLoader /> : r.error ? <ErrorBox message={r.error} onRetry={r.reload} /> :
        r.data!.data.length === 0 ? <EmptyState title="No job listings" text="Create a listing to start receiving applications." action={<Button onClick={() => setEdit('new')}>Create job</Button>} /> : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Title</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Views</th><th className="px-4 py-3">Applicants</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
              <tbody className="divide-y">{r.data!.data.map((j) => (
                <tr key={j.id}>
                  <td className="px-4 py-3"><Link className="font-medium text-brand-700 hover:underline" to={`/jobs/${j.id}`}>{j.title}</Link>{j.featured && <span className="ml-1 text-amber-500" title="Featured">★</span>}<div className="text-slate-500">{j.location}{j.expiresAt ? ` · expires ${new Date(j.expiresAt).toLocaleDateString()}` : ''}</div></td>
                  <td className="px-4 py-3"><Badge value={j.status} />{j.moderation === 'removed' && <span className="ml-1"><Badge value="removed" /></span>}</td>
                  <td className="px-4 py-3">{j.views.toLocaleString()}</td><td className="px-4 py-3">{j.applicationCount}</td>
                  <td className="space-x-1 whitespace-nowrap px-4 py-3 text-right">
                    <Button variant="secondary" onClick={() => setEdit(j.id)}>Edit</Button>
                    {j.status !== 'active' && j.moderation !== 'removed' && <Button variant="secondary" onClick={() => setSt(j, 'active')}>{j.status === 'closed' ? 'Reopen' : 'Publish'}</Button>}
                    {j.status === 'active' && <Button variant="secondary" onClick={() => setSt(j, 'closed')}>Close</Button>}
                    <Button variant="ghost" onClick={() => setDel(j)}>Delete</Button>
                  </td>
                </tr>))}</tbody>
            </table>
          </div>
          <Pagination page={r.data!.meta!.page} totalPages={r.data!.meta!.totalPages} onChange={setPage} />
        </>)}
      {edit && <JobForm id={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); r.reload(); }} />}
      {del && <ConfirmDialog danger title="Delete this job?" text={`"${del.title}" and its ${del.applicationCount} application(s) will be permanently deleted.`} confirmLabel="Delete" onClose={() => setDel(null)}
        onConfirm={async () => { try { await api.del(`/employer/jobs/${del.id}`); toast('Job deleted'); r.reload(); } catch (e) { toast((e as Error).message, 'err'); } }} />}
    </div>
  );
}

function JobForm({ id, onClose, onSaved }: { id: number | 'new'; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const cats = useFetch(() => api.get<Category[]>('/jobs/categories'), []);
  const existing = useFetch(async () => {
    if (id === 'new') return null;
    const j = await api.get<any>(`/employer/jobs/${id}`);
    return { ...EMPTY, ...j, categoryId: String(j.categoryId), salaryMin: j.salaryMin ?? '', salaryMax: j.salaryMax ?? '', skills: (j.skills as string[]).join(', '), expiresAt: isoToLocalInput(j.expiresAt) } as typeof EMPTY;
  }, [id]);
  const [f, setF] = useState<typeof EMPTY | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [publish, setPublish] = useState(false);
  if (existing.loading || cats.loading) return <Modal title="Job" onClose={onClose}><PageLoader /></Modal>;
  const v = f ?? existing.data ?? EMPTY;
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...v, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErrs({});
    const num = (s: string) => (s === '' ? null : Number(s));
    const body = {
      title: v.title, description: v.description, requirements: v.requirements, location: v.location, categoryId: Number(v.categoryId),
      salaryMin: num(String(v.salaryMin)), salaryMax: num(String(v.salaryMax)), salaryCurrency: v.salaryCurrency,
      employmentType: v.employmentType, experienceLevel: v.experienceLevel,
      skills: v.skills.split(',').map((s) => s.trim()).filter(Boolean),
      expiresAt: v.expiresAt ? new Date(`${v.expiresAt}T23:59:59Z`).toISOString() : null,
    };
    setBusy(true);
    try {
      if (id === 'new') await api.post('/employer/jobs', { ...body, publish }); else await api.put(`/employer/jobs/${id}`, body);
      toast(id === 'new' ? 'Job created' : 'Job updated'); onSaved();
    } catch (e) {
      if (e instanceof ApiError) setErrs(Object.fromEntries(Object.entries(e.fields).map(([k, m]) => [k, (m as string[])[0] ?? ''])));
      toast((e as Error).message, 'err');
    } finally { setBusy(false); }
  };
  return (
    <Modal title={id === 'new' ? 'New job listing' : 'Edit job listing'} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <TextField label="Job title" value={v.title} onChange={set('title')} error={errs.title} required />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Location" value={v.location} onChange={set('location')} error={errs.location} required />
          <Select label="Category" value={v.categoryId} onChange={set('categoryId')} error={errs.categoryId} required><option value="">Select…</option>{cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          <Select label="Employment type" value={v.employmentType} onChange={set('employmentType')}><option value="full_time">Full-time</option><option value="part_time">Part-time</option><option value="contract">Contract</option><option value="internship">Internship</option><option value="remote">Remote</option></Select>
          <Select label="Experience level" value={v.experienceLevel} onChange={set('experienceLevel')}><option value="entry">Entry level</option><option value="mid">Mid level</option><option value="senior">Senior</option><option value="lead">Lead</option></Select>
          <TextField label="Salary min (yearly)" type="number" min={0} value={v.salaryMin} onChange={set('salaryMin')} error={errs.salaryMin} />
          <TextField label="Salary max (yearly)" type="number" min={0} value={v.salaryMax} onChange={set('salaryMax')} error={errs.salaryMax} />
          <Select label="Currency" value={v.salaryCurrency} onChange={set('salaryCurrency')}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select>
          <TextField label="Apply by (optional)" type="date" value={v.expiresAt} onChange={set('expiresAt')} error={errs.expiresAt} hint="Listing hides automatically after this date" />
        </div>
        <TextField label="Skills" value={v.skills} onChange={set('skills')} error={errs.skills} hint="Comma-separated, up to 10 (e.g. React, Node.js, SQL)" />
        <TextArea label="Description" rows={6} value={v.description} onChange={set('description')} error={errs.description} hint="At least 20 characters" required />
        <TextArea label="Requirements" rows={4} value={v.requirements} onChange={set('requirements')} error={errs.requirements} required />
        {id === 'new' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} /> Publish immediately</label>}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>{id === 'new' ? 'Create' : 'Save changes'}</Button></div>
      </form>
    </Modal>
  );
}

interface Applicant { id: number; status: string; rating: number | null; createdAt: string; resumeName: string; jobId: number; jobTitle: string; seekerName: string; seekerEmail: string }

function Applicants() {
  const toast = useToast();
  const [view, setView] = useState<'board' | 'table'>('board');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [jobId, setJobId] = useState('');
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const jobs = useFetch(() => api.list<JobRow>('/employer/jobs?pageSize=50'), []);
  const size = view === 'board' ? 100 : 10;
  const r = useFetch(() => api.list<Applicant>(`/employer/applications${qs({ page: view === 'board' ? 1 : page, status: view === 'board' ? '' : status, jobId, q: term, pageSize: size })}`), [page, status, jobId, term, view]);
  const change = async (a: Applicant, s: string) => { try { await api.put(`/employer/applications/${a.id}/status`, { status: s }); toast(`Moved to ${label(s)}`); r.reload(); } catch (e) { toast((e as Error).message, 'err'); r.reload(); } };
  const MoveSel = ({ a }: { a: Applicant }) => EMPLOYER_NEXT[a.status] ? (
    <select aria-label={`Change status for ${a.seekerName}`} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" value="" onChange={(e) => e.target.value && change(a, e.target.value)}>
      <option value="">Move to…</option>{EMPLOYER_NEXT[a.status]!.map((s) => <option key={s} value={s}>{label(s)}</option>)}
    </select>) : null;
  const exportUrl = `/api/employer/applications-export.csv${qs({ status, jobId, q: term })}`;
  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); setTerm(q); setPage(1); }} className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <TextField label="Search candidate" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or email" />
        <Select label="Job" value={jobId} onChange={(e) => { setJobId(e.target.value); setPage(1); }}><option value="">All jobs</option>{jobs.data?.data.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}</Select>
        {view === 'table' && <Select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>}
        <div className="flex items-end gap-2"><Button type="submit">Search</Button><a href={exportUrl} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Export CSV</a></div>
        <div className="flex items-end justify-end lg:col-start-5" role="group" aria-label="View mode">
          <Button type="button" variant={view === 'board' ? 'primary' : 'secondary'} className="rounded-r-none" onClick={() => setView('board')} aria-pressed={view === 'board'}>Board</Button>
          <Button type="button" variant={view === 'table' ? 'primary' : 'secondary'} className="rounded-l-none" onClick={() => setView('table')} aria-pressed={view === 'table'}>Table</Button>
        </div>
      </form>
      {r.loading ? <PageLoader /> : r.error ? <ErrorBox message={r.error} onRetry={r.reload} /> :
        r.data!.data.length === 0 ? <EmptyState title="No applicants found" text="Applications to your listings will appear here." /> :
        view === 'board' ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STATUSES.map((st) => {
              const items = r.data!.data.filter((a) => a.status === st);
              return (
                <section key={st} aria-label={label(st)} className="w-64 shrink-0 rounded-xl bg-slate-100 p-3">
                  <h3 className="mb-3 flex items-center justify-between text-sm font-semibold"><Badge value={st} /><span className="text-slate-500">{items.length}</span></h3>
                  <ul className="space-y-2">
                    {items.map((a) => (
                      <li key={a.id} className="rounded-lg bg-white p-3 shadow-sm">
                        <button className="flex w-full items-center gap-2 text-left" onClick={() => setOpen(a.id)}><Avatar name={a.seekerName} size="sm" /><span className="min-w-0"><span className="block truncate text-sm font-medium">{a.seekerName}</span><span className="block truncate text-xs text-slate-500">{a.jobTitle}</span></span></button>
                        <div className="mt-2 flex items-center justify-between gap-2"><Stars value={a.rating} label={`Rating for ${a.seekerName}`} /><span className="text-xs text-slate-400">{timeAgo(a.createdAt)}</span></div>
                        <div className="mt-2"><MoveSel a={a} /></div>
                      </li>))}
                    {items.length === 0 && <li className="py-4 text-center text-xs text-slate-400">No candidates</li>}
                  </ul>
                </section>);
            })}
          </div>
        ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Candidate</th><th className="px-4 py-3">Job</th><th className="px-4 py-3">Rating</th><th className="px-4 py-3">Applied</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
              <tbody className="divide-y">{r.data!.data.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3"><div className="font-medium">{a.seekerName}</div><div className="text-slate-500">{a.seekerEmail}</div></td>
                  <td className="px-4 py-3">{a.jobTitle}</td><td className="px-4 py-3"><Stars value={a.rating} label={`Rating for ${a.seekerName}`} /></td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(a.createdAt)}</td><td className="px-4 py-3"><Badge value={a.status} /></td>
                  <td className="space-x-2 whitespace-nowrap px-4 py-3 text-right"><Button variant="secondary" onClick={() => setOpen(a.id)}>Review</Button><MoveSel a={a} /></td>
                </tr>))}</tbody>
            </table>
          </div>
          <Pagination page={r.data!.meta!.page} totalPages={r.data!.meta!.totalPages} onChange={setPage} />
        </>)}
      {open && <ApplicantModal id={open} onClose={() => { setOpen(null); r.reload(); }} />}
    </div>
  );
}

function ApplicantModal({ id, onClose }: { id: number; onClose: () => void }) {
  const toast = useToast();
  const d = useFetch(() => api.get<any>(`/employer/applications/${id}`), [id]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const a = d.data;
  const rate = async (v: number | null) => { try { await api.put(`/employer/applications/${id}/rating`, { rating: v }); d.reload(); } catch (e) { toast((e as Error).message, 'err'); } };
  const addNote = async (e: React.FormEvent) => {
    e.preventDefault(); if (!note.trim()) return; setBusy(true);
    try { await api.post(`/employer/applications/${id}/notes`, { note: note.trim() }); setNote(''); d.reload(); } catch (x) { toast((x as Error).message, 'err'); } finally { setBusy(false); }
  };
  return (
    <Modal title="Applicant review" onClose={onClose} wide>
      {d.loading ? <PageLoader /> : d.error ? <ErrorBox message={d.error} /> : (
        <div className="grid gap-6 text-sm md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center gap-3"><Avatar name={a.seekerName} /><div><p className="text-lg font-semibold">{a.seekerName}</p><p className="text-slate-500">{a.headline}</p></div></div>
            <p className="text-slate-600">{a.seekerEmail}{a.phone ? ` · ${a.phone}` : ''}{a.location ? ` · ${a.location}` : ''}</p>
            {a.skills && <p><b>Skills:</b> {a.skills}</p>}{a.bio && <p className="whitespace-pre-line text-slate-700">{a.bio}</p>}
            <p><a className="text-brand-600 underline" href={`/api/files/applications/${id}/resume`}>Download resume ({a.resumeName})</a></p>
            <div><p className="mb-1 font-medium">Your rating</p><Stars value={a.rating} onChange={rate} label="Candidate rating" /></div>
            {a.coverLetter ? <div><p className="font-medium">Cover letter</p><p className="whitespace-pre-line text-slate-700">{a.coverLetter}</p></div> : <p className="text-slate-500">No cover letter provided.</p>}
          </div>
          <div className="space-y-4">
            <p>Applied for <b>{a.jobTitle}</b> · <Badge value={a.status} /></p>
            <div><p className="mb-1 font-medium">Internal notes</p>
              <form onSubmit={addNote} className="flex gap-2"><input aria-label="Add a note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="Visible only to your team" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2" /><Button type="submit" loading={busy} disabled={!note.trim()}>Add</Button></form>
              <ul className="mt-2 space-y-2">{a.notes.length === 0 && <li className="text-slate-400">No notes yet.</li>}{a.notes.map((n: any) => <li key={n.id} className="rounded-lg bg-slate-50 p-2"><p className="whitespace-pre-line">{n.note}</p><p className="mt-1 text-xs text-slate-400">{n.author ?? 'Former member'} · {fmtDate(n.createdAt)}</p></li>)}</ul></div>
            <div><p className="mb-1 font-medium">History</p><ol className="space-y-1 border-l-2 pl-3">{a.events.map((e: any, i: number) => <li key={i}>{label(e.toStatus)} <span className="text-xs text-slate-500">{fmtDate(e.createdAt)}</span></li>)}</ol></div>
          </div>
        </div>)}
    </Modal>
  );
}

function Company() {
  const toast = useToast();
  const r = useFetch(() => api.get<any>('/employer/company'), []);
  const [f, setF] = useState<any>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  if (r.loading) return <PageLoader />;
  if (r.error) return <ErrorBox message={r.error} onRetry={r.reload} />;
  const v = f ?? r.data ?? { name: '', description: '', website: '', location: '', industry: '', size: '' };
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...v, [k]: e.target.value });
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setErrs({}); setBusy(true);
    try { await api.put('/employer/company', { name: v.name, description: v.description || null, website: v.website || null, location: v.location || null, industry: v.industry || null, size: v.size || null }); toast('Company profile saved'); setF(null); r.reload(); }
    catch (e) { if (e instanceof ApiError) setErrs(Object.fromEntries(Object.entries(e.fields).map(([k, m]) => [k, (m as string[])[0] ?? '']))); toast((e as Error).message, 'err'); }
    finally { setBusy(false); }
  };
  return (
    <form onSubmit={save} className="max-w-2xl space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between"><h2 className="font-semibold">Company profile</h2>{r.data?.id && <Link className="text-sm text-brand-600 hover:underline" to={`/companies/${r.data.id}`}>View public page →</Link>}</div>
      <TextField label="Company name" value={v.name} onChange={set('name')} error={errs.name} required />
      <TextField label="Website" type="url" placeholder="https://example.com" value={v.website ?? ''} onChange={set('website')} error={errs.website} />
      <div className="grid gap-4 sm:grid-cols-3"><TextField label="Location" value={v.location ?? ''} onChange={set('location')} /><TextField label="Industry" value={v.industry ?? ''} onChange={set('industry')} /><TextField label="Company size" value={v.size ?? ''} onChange={set('size')} placeholder="e.g. 51-200" /></div>
      <TextArea label="About the company" rows={6} value={v.description ?? ''} onChange={set('description')} />
      <Button type="submit" loading={busy}>Save company</Button>
    </form>
  );
}
