import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { homeFor, useAuth } from './auth';
import { Layout } from './components/Layout';
import { PageLoader } from './components/ui';
import type { Role } from './types';
import Account from './pages/Account';
import Admin from './pages/Admin';
import { ForgotPassword, Login, Register, ResetPassword, VerifyEmail } from './pages/Auth';
import Company from './pages/Company';
import Employer from './pages/Employer';
import Home from './pages/Home';
import JobDetail from './pages/JobDetail';
import Jobs from './pages/Jobs';
import Seeker from './pages/Seeker';

function Guard({ role, children }: { role?: Role; children: JSX.Element }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  if (role && user.role !== role) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}

const NotFound = () => (
  <div className="mx-auto max-w-md px-4 py-24 text-center">
    <p className="text-6xl font-extrabold text-brand-600">404</p><p className="mt-2 text-slate-600">We couldn't find that page.</p>
    <Link to="/" className="mt-6 inline-block rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white">Go home</Link>
  </div>
);

export default function App() {
  const { loading } = useAuth();
  if (loading) return <PageLoader />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="jobs" element={<Jobs />} />
        <Route path="jobs/:id" element={<JobDetail />} />
        <Route path="companies/:id" element={<Company />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="verify-email" element={<VerifyEmail />} />
        <Route path="account" element={<Guard><Account /></Guard>} />
        <Route path="seeker" element={<Guard role="seeker"><Seeker /></Guard>} />
        <Route path="employer" element={<Guard role="employer"><Employer /></Guard>} />
        <Route path="admin" element={<Guard role="admin"><Admin /></Guard>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
