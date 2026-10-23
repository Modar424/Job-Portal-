import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { label } from '../utils';

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; loading?: boolean };
export function Button({ variant = 'primary', loading, className = '', children, disabled, ...p }: BtnProps) {
  const v = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700',
    secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-slate-600 hover:bg-slate-100',
  }[variant];
  return (
    <button {...p} disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${v} ${className}`}>
      {loading && <Spinner small />}
      {children}
    </button>
  );
}

export function Spinner({ small }: { small?: boolean }) {
  return <span role="status" aria-label="Loading" className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${small ? 'h-4 w-4' : 'h-8 w-8 text-brand-600'}`} />;
}

export const PageLoader = () => <div className="flex justify-center py-20"><Spinner /></div>;

export function Field({ label: l, error, hint, children }: { label: string; error?: string; hint?: string; children: (p: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode }) {
  const id = useId();
  const dId = error || hint ? `${id}-d` : undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">{l}</label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': dId })}
      {error ? <p id={dId} className="mt-1 text-sm text-red-600">{error}</p> : hint ? <p id={dId} className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
export const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-brand-500 aria-[invalid=true]:border-red-500';

export function TextField({ label: l, error, hint, ...p }: { label: string; error?: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <Field label={l} error={error} hint={hint}>{(a) => <input {...a} {...p} className={inputCls} />}</Field>;
}
export function TextArea({ label: l, error, hint, ...p }: { label: string; error?: string; hint?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <Field label={l} error={error} hint={hint}>{(a) => <textarea rows={4} {...a} {...p} className={inputCls} />}</Field>;
}
export function Select({ label: l, error, children, ...p }: { label: string; error?: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <Field label={l} error={error}>{(a) => <select {...a} {...p} className={inputCls}>{children}</select>}</Field>;
}

const TONES: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-700', under_review: 'bg-blue-100 text-blue-800', shortlisted: 'bg-indigo-100 text-indigo-800',
  interview: 'bg-amber-100 text-amber-800', accepted: 'bg-green-100 text-green-800', rejected: 'bg-red-100 text-red-800',
  withdrawn: 'bg-slate-200 text-slate-600', draft: 'bg-slate-100 text-slate-700', active: 'bg-green-100 text-green-800',
  closed: 'bg-slate-200 text-slate-600', approved: 'bg-green-100 text-green-800', removed: 'bg-red-100 text-red-800',
  suspended: 'bg-red-100 text-red-800',
};
export const Badge = ({ value }: { value: string }) => (
  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[value] ?? 'bg-slate-100 text-slate-700'}`}>{label(value)}</span>
);
export const Pill = ({ children }: { children: ReactNode }) => <span className="inline-block rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">{children}</span>;

export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</div>
);

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <p className="font-semibold text-slate-800">{title}</p>
      {text && <p className="mt-1 text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <span>{message}</span>
      {onRetry && <Button variant="secondary" onClick={onRetry}>Retry</Button>}
    </div>
  );
}

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-3">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</Button>
      <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
      <Button variant="secondary" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next</Button>
    </nav>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const tid = useId();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0]!, last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus(); };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={tid} tabIndex={-1}
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={tid} className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close dialog" className="rounded p-1 text-slate-500 hover:bg-slate-100">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, text, confirmLabel = 'Confirm', danger, onConfirm, onClose }: { title: string; text: string; confirmLabel?: string; danger?: boolean; onConfirm: () => Promise<void> | void; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm text-slate-600">{text}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); onClose(); } }}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}

interface Toast { id: number; text: string; kind: 'ok' | 'err' }
const ToastCtx = createContext<(text: string, kind?: 'ok' | 'err') => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, text, kind }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="fixed bottom-4 right-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} role={t.kind === 'err' ? 'alert' : 'status'} className={`rounded-lg px-4 py-3 text-sm text-white shadow-lg ${t.kind === 'err' ? 'bg-red-600' : 'bg-slate-900'}`}>{t.text}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div role="tablist" className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${value === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export const StatCard = ({ label: l, value }: { label: string; value: number | string }) => (
  <Card><p className="text-sm text-slate-500">{l}</p><p className="mt-1 text-3xl font-bold text-slate-900">{value}</p></Card>
);

/** Fetches data and exposes loading/error/reload state. */
export function useFetch<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true); setError(null);
    fn().then((d) => live && setData(d)).catch((e) => live && setError(e.message ?? 'Failed to load')).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [...deps, tick]);
  return { data, loading, error, reload: () => setTick((t) => t + 1), setData };
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-slate-200 ${className}`} />;
}
export function JobCardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex gap-4"><Skeleton className="h-12 w-12 rounded-xl" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/3" /></div></div>
      <div className="mt-4 flex gap-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-5 w-16" /><Skeleton className="h-5 w-24" /></div>
    </div>
  );
}

const AV = ['bg-indigo-100 text-indigo-700', 'bg-teal-100 text-teal-700', 'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700', 'bg-sky-100 text-sky-700', 'bg-violet-100 text-violet-700'];
export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const idx = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length;
  const dim = { sm: 'h-8 w-8 text-xs', md: 'h-12 w-12 text-base', lg: 'h-16 w-16 text-xl' }[size];
  const ini = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
  return <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-xl font-bold ${dim} ${AV[idx]}`}>{ini}</span>;
}

export function Stars({ value, onChange, label: l = 'Rating' }: { value: number | null; onChange?: (v: number | null) => void; label?: string }) {
  return (
    <div role={onChange ? 'radiogroup' : 'img'} aria-label={onChange ? l : `${l}: ${value ?? 0} of 5`} className="inline-flex">
      {[1, 2, 3, 4, 5].map((n) => {
        const on = (value ?? 0) >= n;
        const star = <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className={on ? 'fill-amber-400 stroke-amber-500' : 'fill-none stroke-slate-300'} strokeWidth="2"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" /></svg>;
        return onChange
          ? <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => onChange(value === n ? null : n)} className="rounded p-0.5 hover:scale-110">{star}</button>
          : <span key={n}>{star}</span>;
      })}
    </div>
  );
}

/** Dependency-free SVG area chart. */
export function LineChart({ data, color = '#5b5bd6', title }: { data: { date: string; count: number }[]; color?: string; title: string }) {
  const W = 600, H = 180, P = 24;
  const max = Math.max(1, ...data.map((d) => d.count));
  const x = (i: number) => P + (i * (W - 2 * P)) / Math.max(1, data.length - 1);
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  const pts = data.map((d, i) => `${x(i)},${y(d.count)}`).join(' ');
  const total = data.reduce((a, d) => a + d.count, 0);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: ${total} in the last ${data.length} days, peak ${max} per day`} className="h-44 w-full">
        {[0, 0.5, 1].map((t) => <line key={t} x1={P} x2={W - P} y1={y(max * t)} y2={y(max * t)} stroke="#e2e8f0" strokeDasharray="4 4" />)}
        <text x={P - 6} y={y(max) + 4} textAnchor="end" fontSize="10" fill="#64748b">{max}</text>
        <text x={P - 6} y={y(0) + 4} textAnchor="end" fontSize="10" fill="#64748b">0</text>
        {data.length > 1 && <polygon points={`${x(0)},${y(0)} ${pts} ${x(data.length - 1)},${y(0)}`} fill={color} opacity="0.12" />}
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => d.count > 0 && <circle key={d.date} cx={x(i)} cy={y(d.count)} r="3" fill={color}><title>{`${d.date}: ${d.count}`}</title></circle>)}
        <text x={P} y={H - 6} fontSize="10" fill="#64748b">{data[0]?.date.slice(5)}</text>
        <text x={W - P} y={H - 6} fontSize="10" fill="#64748b" textAnchor="end">{data[data.length - 1]?.date.slice(5)}</text>
      </svg>
      <figcaption className="sr-only">{title}</figcaption>
    </figure>
  );
}

export function BarList({ items }: { items: { name: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="text-sm text-slate-500">No data yet.</p>;
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.name}>
          <div className="mb-1 flex justify-between text-sm"><span>{i.name}</span><b>{i.value}</b></div>
          <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand-500" style={{ width: `${(i.value / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}
