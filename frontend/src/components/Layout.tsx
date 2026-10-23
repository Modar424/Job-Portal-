import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { homeFor, useAuth } from '../auth';
import { label, timeAgo } from '../utils';
import { Avatar, useToast } from './ui';

interface Notif { id: number; message: string; link: string | null; isRead: boolean; createdAt: string }

function useOutside(onOut: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onOut();
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onOut();
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [onOut]);
  return ref;
}

function Bell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ items: Notif[]; unread: number }>({ items: [], unread: 0 });
  const nav = useNavigate();
  const ref = useOutside(() => setOpen(false));
  const load = () => api.get<typeof data>('/notifications').then(setData).catch(() => undefined);
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => { setOpen(!open); if (!open) load(); }} aria-label={`Notifications, ${data.unread} unread`} aria-expanded={open} className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
        {data.unread > 0 && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{data.unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[90vw] rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <span className="text-sm font-semibold">Notifications</span>
            {data.unread > 0 && <button className="text-xs text-brand-600 hover:underline" onClick={async () => { await api.post('/notifications/read-all'); load(); }}>Mark all read</button>}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {data.items.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500">You're all caught up.</li>}
            {data.items.map((n) => (
              <li key={n.id}>
                <button onClick={async () => { await api.post(`/notifications/${n.id}/read`).catch(() => undefined); setOpen(false); load(); if (n.link) nav(n.link); }}
                  className={`block w-full px-4 py-3 text-left text-sm hover:bg-slate-50 ${n.isRead ? 'text-slate-500' : 'bg-brand-50/50 font-medium'}`}>
                  {n.message}<span className="mt-0.5 block text-xs font-normal text-slate-400">{timeAgo(n.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const toast = useToast();
  const ref = useOutside(() => setOpen(false));
  if (!user) return null;
  const item = 'block w-full px-4 py-2 text-left text-sm hover:bg-slate-50';
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-slate-100">
        <Avatar name={user.fullName} size="sm" /><span className="max-w-32 truncate text-sm font-medium">{user.fullName}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b px-4 py-3"><p className="truncate text-sm font-semibold">{user.fullName}</p><p className="truncate text-xs text-slate-500">{label(user.role)}</p></div>
          <Link role="menuitem" to={homeFor(user.role)} className={item} onClick={() => setOpen(false)}>Dashboard</Link>
          <Link role="menuitem" to="/account" className={item} onClick={() => setOpen(false)}>Account settings</Link>
          <button role="menuitem" className={`${item} text-red-600`} onClick={async () => { await logout(); toast('Signed out'); nav('/'); }}>Sign out</button>
        </div>
      )}
    </div>
  );
}

function VerifyBanner() {
  const { user } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!user || user.emailVerified) return null;
  return (
    <div role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
      Please verify your email address.{' '}
      <button disabled={busy} className="font-medium underline" onClick={async () => { setBusy(true); try { await api.post('/auth/resend-verification'); toast('Verification email sent'); } catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(false); } }}>Resend link</button>
    </div>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  useEffect(() => { setMenu(false); window.scrollTo(0, 0); }, [loc.pathname]);
  const link = ({ isActive }: { isActive: boolean }) => `rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'text-brand-700' : 'text-slate-600 hover:text-slate-900'}`;
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
      <VerifyBanner />
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold text-brand-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 text-white" aria-hidden="true">H</span>HireNest
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            <NavLink to="/jobs" className={link}>Find jobs</NavLink>
            {user && <NavLink to={homeFor(user.role)} className={link}>Dashboard</NavLink>}
            {!user && <NavLink to="/register?role=employer" className={link}>For employers</NavLink>}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            {user ? (<><Bell /><UserMenu /></>) : (
              <>
                <Link to="/login" className="px-3 py-2 text-sm font-medium text-slate-700 hover:text-slate-900">Sign in</Link>
                <Link to="/register" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700">Get started</Link>
              </>
            )}
          </div>
          <button className="rounded p-2 md:hidden" aria-label="Toggle menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>
        </div>
        {menu && (
          <div className="space-y-1 border-t px-4 py-3 md:hidden">
            <NavLink to="/jobs" className="block rounded px-3 py-2 text-sm">Find jobs</NavLink>
            {user ? (
              <>
                <NavLink to={homeFor(user.role)} className="block rounded px-3 py-2 text-sm">Dashboard</NavLink>
                <NavLink to="/account" className="block rounded px-3 py-2 text-sm">Account settings</NavLink>
                <button className="block w-full rounded px-3 py-2 text-left text-sm text-red-600" onClick={async () => { await logout(); nav('/'); }}>Sign out</button>
              </>
            ) : (
              <>
                <NavLink to="/login" className="block rounded px-3 py-2 text-sm">Sign in</NavLink>
                <NavLink to="/register" className="block rounded px-3 py-2 text-sm">Get started</NavLink>
              </>
            )}
          </div>
        )}
      </header>
      <main id="main" className="flex-1"><Outlet /></main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-4">
          <div className="sm:col-span-2"><p className="flex items-center gap-2 font-bold text-brand-900"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 text-sm text-white" aria-hidden="true">H</span>HireNest</p><p className="mt-2 max-w-sm text-sm text-slate-500">Connecting ambitious people with teams that are growing.</p></div>
          <nav aria-label="Candidates"><p className="mb-2 text-sm font-semibold">Candidates</p><ul className="space-y-1 text-sm text-slate-600"><li><Link to="/jobs">Browse jobs</Link></li><li><Link to="/register">Create profile</Link></li><li><Link to="/login">Sign in</Link></li></ul></nav>
          <nav aria-label="Employers"><p className="mb-2 text-sm font-semibold">Employers</p><ul className="space-y-1 text-sm text-slate-600"><li><Link to="/register?role=employer">Post a job</Link></li><li><Link to="/login">Employer sign in</Link></li></ul></nav>
        </div>
        <div className="border-t py-4 text-center text-xs text-slate-400">© {new Date().getFullYear()} HireNest. All rights reserved.</div>
      </footer>
    </div>
  );
}
