import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, api } from '../api';
import { useAuth } from '../auth';
import { Avatar, Badge, Button, Card, ErrorBox, Modal, TextField, useToast } from '../components/ui';
import { label, validatePassword } from '../utils';

export default function Account() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [f, setF] = useState({ currentPassword: '', newPassword: '' });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(false);
  if (!user) return null;
  const change = async (e: React.FormEvent) => {
    e.preventDefault(); setErrs({});
    const v = validatePassword(f.newPassword);
    if (v) return setErrs({ newPassword: v });
    setBusy(true);
    try { await api.post('/auth/change-password', f); toast('Password updated'); setF({ currentPassword: '', newPassword: '' }); }
    catch (x) { if (x instanceof ApiError) setErrs(Object.fromEntries(Object.entries(x.fields).map(([k, m]) => [k, (m as string[])[0] ?? '']))); toast((x as Error).message, 'err'); }
    finally { setBusy(false); }
  };
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">Account settings</h1>
      <Card>
        <div className="flex items-center gap-4"><Avatar name={user.fullName} size="lg" />
          <div><p className="text-lg font-semibold">{user.fullName}</p><p className="text-sm text-slate-500">{user.email}</p>
            <p className="mt-1 flex items-center gap-2 text-sm"><span>{label(user.role)}</span>{user.emailVerified ? <Badge value="approved" /> : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Email not verified</span>}</p></div></div>
      </Card>
      <Card>
        <h2 className="font-semibold">Change password</h2>
        <form onSubmit={change} className="mt-4 max-w-sm space-y-4">
          <TextField label="Current password" type="password" autoComplete="current-password" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} error={errs.currentPassword} />
          <TextField label="New password" type="password" autoComplete="new-password" value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} error={errs.newPassword} hint="Other devices will be signed out" />
          <Button type="submit" loading={busy}>Update password</Button>
        </form>
      </Card>
      {user.role !== 'admin' && (
        <Card className="border-red-200">
          <h2 className="font-semibold text-red-700">Delete account</h2>
          <p className="mt-1 text-sm text-slate-600">Permanently removes your account and all associated data, including applications{user.role === 'employer' ? ', job listings and company profile' : ' and resumes'}. This cannot be undone.</p>
          <Button variant="danger" className="mt-4" onClick={() => setDel(true)}>Delete my account</Button>
        </Card>)}
      {del && <DeleteModal onClose={() => setDel(false)} onDone={async () => { await logout(); toast('Account deleted'); nav('/'); }} />}
    </div>
  );
}

function DeleteModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Delete your account?" onClose={onClose}>
      <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(null); try { await api.del('/auth/account', { password: pw }); onDone(); } catch (x) { setErr(x instanceof ApiError ? (Object.values(x.fields).flat()[0] ?? x.message) : 'Failed'); } finally { setBusy(false); } }} className="space-y-4">
        <p className="text-sm text-slate-600">Enter your password to confirm.</p>
        <TextField label="Password" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        {err && <ErrorBox message={err} />}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" variant="danger" loading={busy} disabled={!pw}>Delete permanently</Button></div>
      </form>
    </Modal>
  );
}
