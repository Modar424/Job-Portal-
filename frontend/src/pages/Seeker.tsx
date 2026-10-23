import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError, api, qs } from '../api';
import { useAuth } from '../auth';
import { JobCardView } from '../components/JobCardView';
import { Badge, Button, ConfirmDialog, EmptyState, ErrorBox, Modal, PageLoader, Pagination, Select, Tabs, TextArea, TextField, useFetch, useToast } from '../components/ui';
import type { JobCard } from '../types';
import { WITHDRAWABLE, fmtDate, label } from '../utils';

type Tab = 'applications' | 'saved' | 'profile';

export default function SeekerDashboard() {
  const [sp, setSp] = useSearchParams();
  const tab = (['applications', 'saved', 'profile'].includes(sp.get('tab') ?? '') ? sp.get('tab') : 'applications') as Tab;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">My dashboard</h1>
      <Tabs<Tab> value={tab} onChange={(t) => setSp({ tab: t })} tabs={[{ id: 'applications', label: 'Applications' }, { id: 'saved', label: 'Saved jobs' }, { id: 'profile', label: 'Profile & resume' }]} />
      {tab === 'applications' && <Applications />}
      {tab === 'saved' && <Saved />}
      {tab === 'profile' && <Profile />}
    </div>
  );
}

interface App { id: number; status: string; createdAt: string; updatedAt: string; jobId: number; title: string; companyName: string; location: string }
interface AppDetail { id: number; status: string; coverLetter: string | null; resumeName: string; createdAt: string; title: string; companyName: string; jobId: number; events: { fromStatus: string | null; toStatus: string; createdAt: string }[] }

function Applications() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [view, setView] = useState<number | null>(null);
  const [withdraw, setWithdraw] = useState<App | null>(null);
  const r = useFetch(() => api.list<App>(`/seeker/applications${qs({ page, status, pageSize: 10 })}`), [page, status]);
  return (
    <div>
      <div className="mb-4 max-w-xs">
        <Select label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {['pending', 'under_review', 'shortlisted', 'interview', 'accepted', 'rejected', 'withdrawn'].map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </Select>
      </div>
      {r.loading ? <PageLoader /> : r.error ? <ErrorBox message={r.error} onRetry={r.reload} /> :
        r.data!.data.length === 0 ? <EmptyState title="No applications yet" text="Find a role you like and apply in a few clicks." action={<Link to="/jobs" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white">Browse jobs</Link>} /> : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Job</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Applied</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
              <tbody className="divide-y">
                {r.data!.data.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-3"><Link to={`/jobs/${a.jobId}`} className="font-medium text-brand-700 hover:underline">{a.title}</Link><div className="text-slate-500">{a.companyName} · {a.location}</div></td>
                    <td className="px-4 py-3"><Badge value={a.status} /></td>
                    <td className="px-4 py-3 text-slate-600">{fmtDate(a.createdAt)}</td>
                    <td className="space-x-2 px-4 py-3 text-right">
                      <Button variant="secondary" onClick={() => setView(a.id)}>Details</Button>
                      {WITHDRAWABLE.includes(a.status) && <Button variant="ghost" onClick={() => setWithdraw(a)}>Withdraw</Button>}
                    </td>
                  </tr>))}
              </tbody>
            </table>
          </div>
          <Pagination page={r.data!.meta!.page} totalPages={r.data!.meta!.totalPages} onChange={setPage} />
        </>)}
      {view && <Detail id={view} onClose={() => setView(null)} />}
      {withdraw && <ConfirmDialog danger title="Withdraw application?" text={`You will withdraw your application for "${withdraw.title}". This cannot be undone.`} confirmLabel="Withdraw" onClose={() => setWithdraw(null)}
        onConfirm={async () => { try { await api.post(`/seeker/applications/${withdraw.id}/withdraw`); toast('Application withdrawn'); r.reload(); } catch (e) { toast((e as Error).message, 'err'); } }} />}
    </div>
  );
}

function Detail({ id, onClose }: { id: number; onClose: () => void }) {
  const d = useFetch(() => api.get<AppDetail>(`/seeker/applications/${id}`), [id]);
  return (
    <Modal title="Application details" onClose={onClose}>
      {d.loading ? <PageLoader /> : d.error ? <ErrorBox message={d.error} /> : (
        <div className="space-y-4 text-sm">
          <div><p className="font-semibold">{d.data!.title}</p><p className="text-slate-500">{d.data!.companyName}</p></div>
          <p>Status: <Badge value={d.data!.status} /></p>
          <p>Resume: <a className="text-brand-600 underline" href={`/api/files/applications/${id}/resume`}>{d.data!.resumeName}</a></p>
          {d.data!.coverLetter && <div><p className="font-medium">Cover letter</p><p className="whitespace-pre-line text-slate-700">{d.data!.coverLetter}</p></div>}
          <div><p className="mb-2 font-medium">History</p>
            <ol className="space-y-2 border-l-2 border-slate-200 pl-4">
              {d.data!.events.map((e, i) => <li key={i}><span className="font-medium">{label(e.toStatus)}</span><span className="block text-xs text-slate-500">{fmtDate(e.createdAt)}</span></li>)}
            </ol></div>
        </div>)}
    </Modal>
  );
}

function Saved() {
  const toast = useToast();
  const r = useFetch(() => api.get<JobCard[]>('/seeker/saved'), []);
  if (r.loading) return <PageLoader />;
  if (r.error) return <ErrorBox message={r.error} onRetry={r.reload} />;
  if (!r.data!.length) return <EmptyState title="No saved jobs" text="Tap “Save job” on any listing to keep it here." action={<Link to="/jobs" className="text-brand-600 underline">Browse jobs</Link>} />;
  return <div className="space-y-3">{r.data!.map((j) => (
    <div key={j.id} className="flex items-center gap-3"><div className="flex-1"><JobCardView job={j} /></div>
      <Button variant="ghost" aria-label={`Remove ${j.title} from saved`} onClick={async () => { try { await api.del(`/seeker/saved/${j.id}`); toast('Removed'); r.reload(); } catch (e) { toast((e as Error).message, 'err'); } }}>Remove</Button></div>))}</div>;
}

interface Profile { fullName: string; email: string; headline: string | null; phone: string | null; location: string | null; bio: string | null; skills: string | null; resumeName: string | null }

function Profile() {
  const { user } = useAuth();
  const toast = useToast();
  const r = useFetch(() => api.get<Profile>('/seeker/profile'), []);
  const [f, setF] = useState<Profile | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [up, setUp] = useState(false);
  if (r.loading) return <PageLoader />;
  if (r.error) return <ErrorBox message={r.error} onRetry={r.reload} />;
  const v = f ?? r.data!;
  const set = (k: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...v, [k]: e.target.value });
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setErrs({}); setBusy(true);
    try { await api.put('/seeker/profile', { fullName: v.fullName, headline: v.headline, phone: v.phone, location: v.location, bio: v.bio, skills: v.skills }); toast('Profile saved'); r.reload(); setF(null); }
    catch (e) { if (e instanceof ApiError) setErrs(Object.fromEntries(Object.entries(e.fields).map(([k, m]) => [k, (m as string[])[0] ?? '']))); toast((e as Error).message, 'err'); }
    finally { setBusy(false); }
  };
  const onFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast('Resume must be 5 MB or smaller', 'err');
    const fd = new FormData(); fd.set('resume', file); setUp(true);
    try { await api.upload('/seeker/resume', fd); toast('Resume uploaded'); r.reload(); } catch (e) { toast((e as Error).message, 'err'); } finally { setUp(false); }
  };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={save} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Personal details</h2>
        <TextField label="Full name" value={v.fullName} onChange={set('fullName')} error={errs.fullName} required />
        <TextField label="Email" value={user?.email ?? v.email} disabled />
        <TextField label="Headline" value={v.headline ?? ''} onChange={set('headline')} placeholder="e.g. Full-stack developer" error={errs.headline} />
        <div className="grid gap-4 sm:grid-cols-2"><TextField label="Phone" value={v.phone ?? ''} onChange={set('phone')} /><TextField label="Location" value={v.location ?? ''} onChange={set('location')} /></div>
        <TextField label="Skills" value={v.skills ?? ''} onChange={set('skills')} hint="Comma-separated" />
        <TextArea label="About you" value={v.bio ?? ''} onChange={set('bio')} />
        <Button type="submit" loading={busy}>Save profile</Button>
      </form>
      <div className="h-fit space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Resume</h2>
        {r.data!.resumeName ? <p className="text-sm">Current: <a href="/api/files/me/resume" className="text-brand-600 underline">{r.data!.resumeName}</a></p> : <p className="text-sm text-slate-500">No resume uploaded yet.</p>}
        <label className="block text-sm font-medium" htmlFor="rf">{r.data!.resumeName ? 'Replace resume' : 'Upload resume'} (PDF, DOC, DOCX · 5 MB)</label>
        <input id="rf" type="file" accept=".pdf,.doc,.docx" disabled={up} onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} className="block w-full text-sm" />
        {up && <p className="text-sm text-slate-500">Uploading…</p>}
      </div>
    </div>
  );
}
