import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { login } from '@netlify/identity';
import AuthShell from '../components/auth/AuthShell';
import FormMessage from '../components/auth/FormMessage';
import SEO from '../components/SEO';
import { useAuth } from '../components/auth/AuthProvider';
import { friendlyAuthError, safeReturnPath } from '../utils/auth-errors';

export default function Login() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [status, setStatus] = useState({ loading: false, error: '' });
  const destination = safeReturnPath(router.query.next);

  useEffect(() => { if (!loading && user) router.replace(destination); }, [loading, user, destination, router]);

  const submit = async (event) => {
    event.preventDefault();
    setStatus({ loading: true, error: '' });
    try {
      await login(form.email.trim(), form.password);
      window.location.href = destination;
    } catch (error) {
      setStatus({ loading: false, error: friendlyAuthError(error) });
    }
  };

  return (
    <>
      <SEO title="Log in | Unboxed Together" description="Log in to your Unboxed Together member account." path="/login" />
      <AuthShell eyebrow="Member access" title="Welcome back" intro="Pick up where you left off with the additive library and your own starting point." footer={<p>New here? <Link href="/signup">Join free</Link></p>}>
        <form className="auth-form" onSubmit={submit}>
          <FormMessage error={status.error} />
          <label htmlFor="email">Email address</label>
          <input id="email" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <div className="label-line"><label htmlFor="password">Password</label><Link href="/forgot-password">Forgotten password?</Link></div>
          <input id="password" type="password" required autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <button className="member-button" type="submit" disabled={status.loading}>{status.loading ? 'Logging in…' : 'Log in'}</button>
        </form>
      </AuthShell>
    </>
  );
}
