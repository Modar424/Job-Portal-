import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, api } from '../api';
import { homeFor, useAuth } from '../auth';
import { Button, Card, ErrorBox, PageLoader, Select, TextField } from '../components/ui';
import { validateEmail, validatePassword } from '../utils';

const Shell = ({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) => (
  <div className="mx-auto max-w-md px-4 py-14"><Card><h1 className="text-2xl font-bold">{title}</h1>{sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}{children}</Card></div>
);

export function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const [f, setF] = useState({ email: '', password: '' });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={from ?? homeFor(user.role)} replace />;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null);
    const v: Record<string, string> = {};
    if (!validateEmail(f.email)) v.email = 'Enter a valid email address';
    if (!f.password) v.password = 'Enter your password';
    setErrs(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    try { const u = await login(f.email, f.password); nav(from ?? homeFor(u.role), { replace: true }); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Shell title="Welcome back" sub="Sign in to continue to HireNest.">
      <form onSubmit={submit} noValidate className="mt-6 space-y-4">
        {err && <ErrorBox message={err} />}
        <TextField label="Email" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} error={errs.email} />
        <TextField label="Password" type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} error={errs.password} />
        <div className="text-right"><Link to="/forgot-password" className="text-sm text-brand-600 hover:underline">Forgot password?</Link></div>
        <Button type="submit" className="w-full" loading={busy}>Sign in</Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">New here? <Link to="/register" className="font-medium text-brand-600">Create an account</Link></p>
    </Shell>
  );
}

export function Register() {
  const { user, register } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [f, setF] = useState({ fullName: '', email: '', password: '', role: sp.get('role') === 'employer' ? 'employer' : 'seeker', companyName: '' });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={homeFor(user.role)} replace />;
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null);
    const v: Record<string, string> = {};
    if (f.fullName.trim().length < 2) v.fullName = 'Enter your full name';
    if (!validateEmail(f.email)) v.email = 'Enter a valid email address';
    const pw = validatePassword(f.password); if (pw) v.password = pw;
    if (f.role === 'employer' && f.companyName.trim().length < 2) v.companyName = 'Enter your company name';
    setErrs(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      const u = await register({ email: f.email, password: f.password, fullName: f.fullName.trim(), role: f.role as 'seeker' | 'employer', companyName: f.role === 'employer' ? f.companyName.trim() : undefined });
      nav(homeFor(u.role), { replace: true });
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fields).length) setErrs(Object.fromEntries(Object.entries(e.fields).map(([k, m]) => [k, (m as string[])[0] ?? ''])));
      setErr((e as Error).message);
    } finally { setBusy(false); }
  };
  return (
    <Shell title="Create your account">
      <form onSubmit={submit} noValidate className="mt-6 space-y-4">
        {err && <ErrorBox message={err} />}
        <Select label="I am a" value={f.role} onChange={set('role')}><option value="seeker">Job seeker</option><option value="employer">Employer</option></Select>
        <TextField label="Full name" autoComplete="name" value={f.fullName} onChange={set('fullName')} error={errs.fullName} />
        {f.role === 'employer' && <TextField label="Company name" value={f.companyName} onChange={set('companyName')} error={errs.companyName} />}
        <TextField label="Email" type="email" autoComplete="email" value={f.email} onChange={set('email')} error={errs.email} />
        <TextField label="Password" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} error={errs.password} hint="At least 8 characters with a letter and a number" />
        <Button type="submit" className="w-full" loading={busy}>Create account</Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">Already registered? <Link to="/login" className="font-medium text-brand-600">Sign in</Link></p>
    </Shell>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Shell title="Reset your password" sub="Enter your email and we'll send you a reset link.">
      {done ? <p role="status" className="mt-6 rounded-lg bg-green-50 p-4 text-sm text-green-800">If that email is registered, a reset link is on its way. It expires in 1 hour.</p> : (
        <form noValidate className="mt-6 space-y-4" onSubmit={async (e) => {
          e.preventDefault(); setErr(null);
          if (!validateEmail(email)) return setErr('Enter a valid email address');
          setBusy(true);
          try { await api.post('/auth/forgot-password', { email }); setDone(true); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
        }}>
          {err && <ErrorBox message={err} />}
          <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" className="w-full" loading={busy}>Send reset link</Button>
        </form>)}
      <p className="mt-4 text-center text-sm"><Link to="/login" className="text-brand-600">Back to sign in</Link></p>
    </Shell>
  );
}

export function ResetPassword() {
  const [sp] = useSearchParams();
  const token = sp.get('token') ?? '';
  const nav = useNavigate();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (token.length !== 64) return <Shell title="Invalid link"><p className="mt-4 text-sm text-slate-600">This reset link is invalid. <Link to="/forgot-password" className="text-brand-600 underline">Request a new one</Link>.</p></Shell>;
  return (
    <Shell title="Choose a new password">
      <form noValidate className="mt-6 space-y-4" onSubmit={async (e) => {
        e.preventDefault(); setErr(null);
        const v = validatePassword(pw); if (v) return setErr(v);
        setBusy(true);
        try { await api.post('/auth/reset-password', { token, password: pw }); nav('/login', { replace: true }); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
      }}>
        {err && <ErrorBox message={err} />}
        <TextField label="New password" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} hint="At least 8 characters with a letter and a number" />
        <Button type="submit" className="w-full" loading={busy}>Update password</Button>
      </form>
    </Shell>
  );
}

export function VerifyEmail() {
  const [sp] = useSearchParams();
  const token = sp.get('token') ?? '';
  const [state, setState] = useState<'loading' | 'ok' | 'err'>('loading');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (token.length !== 64) { setState('err'); setMsg('This verification link is invalid.'); return; }
    api.post('/auth/verify-email', { token }).then(() => setState('ok')).catch((e) => { setState('err'); setMsg(e.message); });
  }, [token]);
  if (state === 'loading') return <PageLoader />;
  return (
    <Shell title={state === 'ok' ? 'Email verified' : 'Verification failed'}>
      <p className="mt-4 text-sm text-slate-600">{state === 'ok' ? 'Thanks! Your email address is now verified.' : msg}</p>
      <Link to="/" onClick={() => state === 'ok' && window.location.assign('/')} className="mt-6 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white">Continue</Link>
    </Shell>
  );
}
