import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ApiError, api } from '../api';
import { useAuth } from '../auth';
import { JobCardView } from '../components/JobCardView';
import { Avatar, Badge, Button, Card, ErrorBox, Modal, PageLoader, Pill, Select, TextArea, useFetch, useToast } from '../components/ui';
import type { JobCard } from '../types';
import { formatSalary, label, timeAgo } from '../utils';

interface Detail extends JobCard {
  description: string; requirements: string; companyDescription: string | null; companyWebsite: string | null;
  companyIndustry: string | null; companySize: string | null; moderation: string; isOpen: boolean; reported: boolean;
  saved: boolean; application: { id: number; status: string } | null;
}

export default function JobDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const loc = useLocation();
  const { data: job, loading, error, reload } = useFetch(() => api.get<Detail>(`/jobs/${id}`), [id]);
  const similar = useFetch(() => api.get<JobCard[]>(`/jobs/${id}/similar`), [id]);
  const [applying, setApplying] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [saving, setSaving] = useState(false);
  if (loading) return <PageLoader />;
  if (error || !job) return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorBox message={error ?? 'Job not found'} onRetry={reload} /><Link to="/jobs" className="mt-4 inline-block text-brand-600">← Back to jobs</Link></div>;

  const toggleSave = async () => {
    setSaving(true);
    try { job.saved ? await api.del(`/seeker/saved/${job.id}`) : await api.put(`/seeker/saved/${job.id}`); toast(job.saved ? 'Removed from saved jobs' : 'Job saved'); reload(); }
    catch (e) { toast((e as Error).message, 'err'); } finally { setSaving(false); }
  };
  const share = async () => {
    try { await navigator.clipboard.writeText(window.location.href); toast('Link copied'); } catch { toast('Could not copy the link', 'err'); }
  };
  const expired = job.status === 'active' && !job.isOpen && job.moderation === 'approved';

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-slate-500"><Link to="/jobs" className="hover:underline">Jobs</Link> / <span className="text-slate-700">{job.title}</span></nav>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <article>
          <div className="flex items-start gap-4">
            <Avatar name={job.companyName} size="lg" />
            <div className="min-w-0">
              <h1 className="text-3xl font-bold leading-tight">{job.title}</h1>
              <p className="mt-1 text-slate-600"><Link to={`/companies/${job.companyId}`} className="font-medium text-brand-700 hover:underline">{job.companyName}</Link> · {job.location} · Posted {timeAgo(job.createdAt)}</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {job.featured && <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">★ Featured</span>}
            <Pill>{label(job.employmentType)}</Pill><Pill>{label(job.experienceLevel)}</Pill>{job.category && <Pill>{job.category}</Pill>}
            {!job.isOpen && <Badge value={expired ? 'closed' : job.status} />}
          </div>
          {!job.isOpen && <div role="status" className="mt-4 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700">{expired ? 'This listing has expired.' : job.status === 'draft' ? 'This listing is a draft and not publicly visible.' : 'This listing is no longer accepting applications.'}</div>}
          <h2 className="mt-8 text-lg font-semibold">About the role</h2>
          <p className="mt-2 whitespace-pre-line leading-relaxed text-slate-700">{job.description}</p>
          <h2 className="mt-8 text-lg font-semibold">Requirements</h2>
          <p className="mt-2 whitespace-pre-line leading-relaxed text-slate-700">{job.requirements}</p>
          {job.skills.length > 0 && (<><h2 className="mt-8 text-lg font-semibold">Skills</h2><ul className="mt-2 flex flex-wrap gap-2">{job.skills.map((s) => <li key={s}><Link to={`/jobs?skill=${encodeURIComponent(s)}`} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm hover:border-brand-500">{s}</Link></li>)}</ul></>)}
          {job.companyDescription && (<><h2 className="mt-8 text-lg font-semibold">About {job.companyName}</h2><p className="mt-2 whitespace-pre-line leading-relaxed text-slate-700">{job.companyDescription}</p></>)}
        </article>
        <aside className="h-fit space-y-4 lg:sticky lg:top-24">
          <Card>
            <p className="text-sm text-slate-500">Salary</p>
            <p className="text-xl font-bold">{formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency)}</p>
            <div className="mt-5 space-y-2">
              {!user && <Link to="/login" state={{ from: loc.pathname }} className="block rounded-lg bg-brand-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-brand-700">Sign in to apply</Link>}
              {user?.role === 'seeker' && (job.application ? (
                <div className="rounded-lg bg-slate-50 p-3 text-sm">You applied · <Badge value={job.application.status} /><Link className="ml-2 text-brand-600 underline" to="/seeker?tab=applications">Track</Link></div>
              ) : job.isOpen ? <Button className="w-full" onClick={() => setApplying(true)}>Apply now</Button> : <p className="text-sm text-slate-500">Not accepting applications.</p>)}
              {user?.role === 'seeker' && job.isOpen && <Button variant="secondary" className="w-full" loading={saving} onClick={toggleSave}>{job.saved ? '★ Saved' : '☆ Save job'}</Button>}
              {user && user.role !== 'seeker' && <p className="text-sm text-slate-500">Only job seeker accounts can apply.</p>}
              <Button variant="ghost" className="w-full" onClick={share}>Copy link</Button>
            </div>
            <dl className="mt-5 space-y-1 border-t pt-4 text-sm text-slate-600">
              {job.companyIndustry && <div className="flex justify-between"><dt>Industry</dt><dd>{job.companyIndustry}</dd></div>}
              {job.companySize && <div className="flex justify-between"><dt>Company size</dt><dd>{job.companySize}</dd></div>}
              <div className="flex justify-between"><dt>Views</dt><dd>{job.views.toLocaleString()}</dd></div>
              {job.expiresAt && <div className="flex justify-between"><dt>Apply by</dt><dd>{new Date(job.expiresAt).toLocaleDateString()}</dd></div>}
            </dl>
            {job.companyWebsite && <a href={job.companyWebsite} target="_blank" rel="noopener noreferrer" className="mt-3 block text-sm text-brand-600 hover:underline">Company website ↗</a>}
          </Card>
          {user?.role === 'seeker' && (job.reported ? <p className="text-center text-xs text-slate-400">You reported this listing.</p> : <button onClick={() => setReporting(true)} className="block w-full text-center text-xs text-slate-500 underline hover:text-slate-800">Report this listing</button>)}
        </aside>
      </div>
      {similar.data && similar.data.length > 0 && (
        <section className="mt-12"><h2 className="mb-4 text-xl font-bold">Similar jobs</h2><div className="grid gap-4 md:grid-cols-2">{similar.data.map((j) => <JobCardView key={j.id} job={j} />)}</div></section>
      )}
      {applying && <ApplyModal jobId={job.id} onClose={() => setApplying(false)} onDone={() => { setApplying(false); reload(); }} />}
      {reporting && <ReportModal jobId={job.id} onClose={() => setReporting(false)} onDone={() => { setReporting(false); reload(); }} />}
    </div>
  );
}

function ApplyModal({ jobId, onClose, onDone }: { jobId: number; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [cover, setCover] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null);
    if (file && file.size > 5 * 1024 * 1024) return setErr('Resume must be 5 MB or smaller');
    const fd = new FormData();
    if (cover.trim()) fd.set('coverLetter', cover.trim());
    if (file) fd.set('resume', file);
    setBusy(true);
    try { await api.upload(`/seeker/jobs/${jobId}/apply`, fd); toast('Application submitted'); onDone(); }
    catch (e) { setErr(e instanceof ApiError ? (Object.values(e.fields).flat()[0] ?? e.message) : 'Failed to submit'); }
    finally { setBusy(false); }
  };
  return (
    <Modal title="Apply for this job" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="resume" className="mb-1 block text-sm font-medium">Resume (PDF, DOC, DOCX · max 5 MB)</label>
          <input id="resume" type="file" accept=".pdf,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
          <p className="mt-1 text-xs text-slate-500">Leave empty to use the resume saved on your profile.</p>
        </div>
        <TextArea label="Cover letter (optional)" value={cover} onChange={(e) => setCover(e.target.value)} maxLength={5000} rows={6} />
        {err && <ErrorBox message={err} />}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Submit application</Button></div>
      </form>
    </Modal>
  );
}

function ReportModal({ jobId, onClose, onDone }: { jobId: number; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState('spam');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Modal title="Report this listing" onClose={onClose}>
      <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(null); try { await api.post(`/jobs/${jobId}/report`, { reason, details: details.trim() || undefined }); toast('Thanks — our team will review this listing'); onDone(); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); } }} className="space-y-4">
        <Select label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="spam">Spam</option><option value="scam">Scam or fraud</option><option value="discriminatory">Discriminatory</option><option value="inaccurate">Inaccurate information</option><option value="other">Other</option>
        </Select>
        <TextArea label="Details (optional)" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} />
        {err && <ErrorBox message={err} />}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" variant="danger" loading={busy}>Submit report</Button></div>
      </form>
    </Modal>
  );
}
