import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, qs } from '../api';
import { useAuth } from '../auth';
import { Badge, BarList, Button, Card, ConfirmDialog, EmptyState, ErrorBox, LineChart, PageLoader, Pagination, Select, StatCard, Tabs, TextField, useFetch, useToast } from '../components/ui';
import type { DayPoint } from '../types';
import { fmtDate, label, timeAgo } from '../utils';

type Tab = 'overview' | 'users' | 'jobs' | 'reports' | 'audit';
const TAB_LIST: Tab[] = ['overview', 'users', 'jobs', 'reports', 'audit'];

export default function AdminDashboard() {
  const [sp, setSp] = useSearchParams();
  const tab = (TAB_LIST.includes(sp.get('tab') as Tab) ? sp.get('tab') : 'overview') as Tab;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Administration</h1>
      <Tabs<Tab> value={tab} onChange={(t) => setSp({ tab: t })} tabs={[{ id: 'overview', label: 'Overview' }, { id: 'users', label: 'Users' }, { id: 'jobs', label: 'Job moderation' }, { id: 'reports', label: 'Reports' }, { id: 'audit', label: 'Audit log' }]} />
      {tab === 'overview' && <Overview />}{tab === 'users' && <Users />}{tab === 'jobs' && <JobsMod />}{tab === 'reports' && <Reports />}{tab === 'audit' && <Audit />}
    </div>
  );
}

function Overview() {
  const r = useFetch(() => api.get<any>('/admin/stats'), []);
  const a = useFetch(() => api.get<{ signups: DayPoint[]; applications: DayPoint[]; jobsPosted: DayPoint[]; topCategories: { name: string; jobs: number }[] }>('/admin/analytics'), []);
  if (r.loading || a.loading) return <PageLoader />;
  if (r.error || a.error) return <ErrorBox message={(r.error ?? a.error)!} onRetry={() => { r.reload(); a.reload(); }} />;
  const s = r.data;
  const apps = Object.values(s.applications as Record<string, number>).reduce((x, y) => x + y, 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Job seekers" value={s.users.seeker ?? 0} /><StatCard label="Employers" value={s.users.employer ?? 0} />
        <StatCard label="Live jobs" value={s.activeJobs} /><StatCard label="Applications" value={apps} />
        <StatCard label="Companies" value={s.companies} /><StatCard label="Open reports" value={s.openReports} />
        <StatCard label="Suspended accounts" value={s.suspendedUsers} /><StatCard label="Unverified emails" value={s.unverifiedUsers} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><h2 className="mb-2 font-semibold">New users · 30 days</h2><LineChart data={a.data!.signups} title="New users per day" /></Card>
        <Card><h2 className="mb-2 font-semibold">Applications · 30 days</h2><LineChart data={a.data!.applications} color="#0d9488" title="Applications per day" /></Card>
        <Card><h2 className="mb-2 font-semibold">Jobs posted · 30 days</h2><LineChart data={a.data!.jobsPosted} color="#d97706" title="Jobs posted per day" /></Card>
        <Card><h2 className="mb-4 font-semibold">Live jobs by category</h2><BarList items={a.data!.topCategories.map((c) => ({ name: c.name, value: c.jobs }))} /></Card>
      </div>
    </div>
  );
}

function Users() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [confirm, setConfirm] = useState<any>(null);
  const r = useFetch(() => api.list<any>(`/admin/users${qs({ q: term, role, status, page, pageSize: 10 })}`), [term, role, status, page]);
  const patch = async (id: number, body: object) => { try { await api.patch(`/admin/users/${id}`, body); toast('User updated'); r.reload(); } catch (e) { toast((e as Error).message, 'err'); } };
  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); setTerm(q); setPage(1); }} className="mb-4 grid gap-3 sm:grid-cols-4">
        <TextField label="Search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or email" />
        <Select label="Role" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}><option value="">All roles</option><option value="seeker">Job seeker</option><option value="employer">Employer</option><option value="admin">Administrator</option></Select>
        <Select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All</option><option value="active">Active</option><option value="suspended">Suspended</option></Select>
        <div className="flex items-end"><Button type="submit">Search</Button></div>
      </form>
      {r.loading ? <PageLoader /> : r.error ? <ErrorBox message={r.error} onRetry={r.reload} /> : r.data!.data.length === 0 ? <EmptyState title="No users found" /> : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">User</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Last login</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
              <tbody className="divide-y">{r.data!.data.map((u: any) => (
                <tr key={u.id}>
                  <td className="px-4 py-3"><div className="font-medium">{u.fullName}</div><div className="text-slate-500">{u.email}{!u.emailVerified && <span className="ml-1 text-xs text-amber-600">(unverified)</span>}</div></td>
                  <td className="px-4 py-3">
                    {u.id === me?.id ? label(u.role) : (
                      <select aria-label={`Role for ${u.fullName}`} className="rounded-lg border border-slate-300 px-2 py-1 text-sm" value={u.role} onChange={(e) => setConfirm({ u, body: { role: e.target.value }, text: `Change ${u.fullName}'s role to ${label(e.target.value)}?` })}>
                        {['seeker', 'admin'].concat(u.role === 'employer' ? ['employer'] : []).map((r2) => <option key={r2} value={r2}>{label(r2)}</option>)}
                      </select>)}
                  </td>
                  <td className="px-4 py-3"><Badge value={u.status} />{u.locked && <span className="ml-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-800">Locked</span>}</td>
                  <td className="px-4 py-3 text-slate-600">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'Never'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">{u.id !== me?.id && (u.status === 'active'
                    ? <Button variant="secondary" onClick={() => setConfirm({ u, body: { status: 'suspended' }, text: `Suspend ${u.fullName}? They will be signed out and unable to log in.`, danger: true })}>Suspend</Button>
                    : <Button variant="secondary" onClick={() => patch(u.id, { status: 'active' })}>Reactivate</Button>)}
                    {u.id !== me?.id && u.status === 'active' && u.locked && <Button variant="ghost" onClick={() => patch(u.id, { status: 'active' })}>Unlock</Button>}</td>
                </tr>))}</tbody>
            </table>
          </div>
          <Pagination page={r.data!.meta!.page} totalPages={r.data!.meta!.totalPages} onChange={setPage} />
        </>)}
      {confirm && <ConfirmDialog title="Confirm change" text={confirm.text} danger={confirm.danger} onClose={() => { setConfirm(null); r.reload(); }} onConfirm={() => patch(confirm.u.id, confirm.body)} />}
    </div>
  );
}

function JobsMod() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [moderation, setModeration] = useState('');
  const r = useFetch(() => api.list<any>(`/admin/jobs${qs({ q: term, moderation, page, pageSize: 10 })}`), [term, moderation, page]);
  const act = async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); toast(msg); r.reload(); } catch (e) { toast((e as Error).message, 'err'); } };
  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); setTerm(q); setPage(1); }} className="mb-4 grid gap-3 sm:grid-cols-3">
        <TextField label="Search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title or company" />
        <Select label="Moderation" value={moderation} onChange={(e) => { setModeration(e.target.value); setPage(1); }}><option value="">All</option><option value="approved">Approved</option><option value="removed">Removed</option></Select>
        <div className="flex items-end"><Button type="submit">Search</Button></div>
      </form>
      {r.loading ? <PageLoader /> : r.error ? <ErrorBox message={r.error} onRetry={r.reload} /> : r.data!.data.length === 0 ? <EmptyState title="No listings found" /> : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Listing</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Moderation</th><th className="px-4 py-3">Reports</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
              <tbody className="divide-y">{r.data!.data.map((j: any) => (
                <tr key={j.id}>
                  <td className="px-4 py-3"><Link className="font-medium text-brand-700 hover:underline" to={`/jobs/${j.id}`}>{j.title}</Link>{j.featured && <span className="ml-1 text-amber-500">★</span>}<div className="text-slate-500">{j.companyName}</div></td>
                  <td className="px-4 py-3"><Badge value={j.status} /></td><td className="px-4 py-3"><Badge value={j.moderation} /></td>
                  <td className="px-4 py-3">{j.openReports > 0 ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">{j.openReports} open</span> : '–'}</td>
                  <td className="space-x-1 whitespace-nowrap px-4 py-3 text-right">
                    <Button variant="ghost" onClick={() => act(() => api.patch(`/admin/jobs/${j.id}/feature`, { featured: !j.featured }), j.featured ? 'Unfeatured' : 'Featured')}>{j.featured ? 'Unfeature' : 'Feature'}</Button>
                    {j.moderation === 'approved' ? <Button variant="danger" onClick={() => act(() => api.patch(`/admin/jobs/${j.id}/moderation`, { moderation: 'removed' }), 'Listing removed')}>Remove</Button> : <Button variant="secondary" onClick={() => act(() => api.patch(`/admin/jobs/${j.id}/moderation`, { moderation: 'approved' }), 'Listing restored')}>Restore</Button>}
                  </td>
                </tr>))}</tbody>
            </table>
          </div>
          <Pagination page={r.data!.meta!.page} totalPages={r.data!.meta!.totalPages} onChange={setPage} />
        </>)}
    </div>
  );
}

function Reports() {
  const toast = useToast();
  const [status, setStatus] = useState('open');
  const [page, setPage] = useState(1);
  const r = useFetch(() => api.list<any>(`/admin/reports${qs({ status, page, pageSize: 10 })}`), [status, page]);
  const act = async (id: number, body: object, msg: string) => { try { await api.patch(`/admin/reports/${id}`, body); toast(msg); r.reload(); } catch (e) { toast((e as Error).message, 'err'); } };
  return (
    <div>
      <div className="mb-4 w-48"><Select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="open">Open</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></Select></div>
      {r.loading ? <PageLoader /> : r.error ? <ErrorBox message={r.error} onRetry={r.reload} /> : r.data!.data.length === 0 ? <EmptyState title={`No ${status} reports`} text="Reports submitted by job seekers appear here." /> : (
        <>
          <ul className="space-y-3">
            {r.data!.data.map((x: any) => (
              <li key={x.id}><Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="font-semibold"><Link className="text-brand-700 hover:underline" to={`/jobs/${x.jobId}`}>{x.jobTitle}</Link> <span className="font-normal text-slate-500">· {x.companyName}</span></p>
                    <p className="mt-1 text-sm"><span className="rounded bg-red-50 px-2 py-0.5 text-red-700">{label(x.reason)}</span> <span className="text-slate-500">reported by {x.reporterName} · {fmtDate(x.createdAt)}</span></p>
                    {x.details && <p className="mt-2 text-sm text-slate-700">{x.details}</p>}</div>
                  {status === 'open' && <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => act(x.id, { status: 'dismissed' }, 'Report dismissed')}>Dismiss</Button><Button variant="secondary" onClick={() => act(x.id, { status: 'resolved' }, 'Report resolved')}>Resolve</Button>{x.moderation === 'approved' && <Button variant="danger" onClick={() => act(x.id, { status: 'resolved', removeJob: true }, 'Listing removed')}>Resolve & remove job</Button>}</div>}
                </div></Card></li>))}
          </ul>
          <Pagination page={r.data!.meta!.page} totalPages={r.data!.meta!.totalPages} onChange={setPage} />
        </>)}
    </div>
  );
}

function Audit() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const r = useFetch(() => api.list<any>(`/admin/audit${qs({ action, page, pageSize: 20 })}`), [action, page]);
  return (
    <div>
      <div className="mb-4 w-64"><Select label="Event type" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
        <option value="">All events</option><option value="auth.">Authentication</option><option value="job.">Job activity</option><option value="admin.">Admin actions</option><option value="account.">Account</option>
      </Select></div>
      {r.loading ? <PageLoader /> : r.error ? <ErrorBox message={r.error} onRetry={r.reload} /> : r.data!.data.length === 0 ? <EmptyState title="No events recorded" /> : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Actor</th><th className="px-4 py-3">Event</th><th className="px-4 py-3">Entity</th><th className="px-4 py-3">IP</th></tr></thead>
              <tbody className="divide-y">{r.data!.data.map((e: any) => (
                <tr key={e.id}><td className="whitespace-nowrap px-4 py-2 text-slate-600">{fmtDate(e.createdAt)}</td><td className="px-4 py-2">{e.actorEmail ?? <span className="text-slate-400">system / deleted</span>}</td>
                  <td className="px-4 py-2 font-mono text-xs">{e.action}</td><td className="px-4 py-2 text-slate-600">{e.entityType ? `${e.entityType} #${e.entityId ?? ''}` : '–'}</td><td className="px-4 py-2 text-slate-500">{e.ip ?? '–'}</td></tr>))}</tbody>
            </table>
          </div>
          <Pagination page={r.data!.meta!.page} totalPages={r.data!.meta!.totalPages} onChange={setPage} />
        </>)}
    </div>
  );
}
