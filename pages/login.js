import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { login, signup } from '@netlify/identity';
import AuthShell from '../components/auth/AuthShell';
import FormMessage from '../components/auth/FormMessage';
import SEO from '../components/SEO';
import { useAuth } from '../components/auth/AuthProvider';
import { friendlyAuthError, isAlreadyRegisteredError, isUnconfirmedError, safeReturnPath } from '../utils/auth-errors';

export default function Login() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [status, setStatus] = useState({ loading: false, error: '', success: '', unconfirmed: false });
  const destination = safeReturnPath(router.query.next);

  useEffect(() => { if (!loading && user) router.replace(destination); }, [loading, user, destination, router]);

  const submit = async (event) => {
    event.preventDefault();
    setStatus({ loading: true, error: '', success: '', unconfirmed: false });
    try {
      await login(form.email.trim(), form.password);
      window.location.href = destination;
    } catch (error) {
      setStatus({ loading: false, error: friendlyAuthError(error), success: '', unconfirmed: isUnconfirmedError(error) });
    }
  };

  // Signing up again with the same details asks Identity for a fresh
  // confirmation link. Identity silently skips it within 15 minutes of the
  // last one, so the message does not promise a new email.
  const resendConfirmation = async () => {
    setStatus({ loading: true, error: '', success: '', unconfirmed: true });
    try {
      const again = await signup(form.email.trim(), form.password);
      if (again.emailVerified) {
        window.location.href = destination;
        return;
      }
      setStatus({ loading: false, error: '', success: 'If your account still needs confirming, a new link is on its way to your inbox. Only one email can be sent every 15 minutes, so please also check for the earlier one (including your spam or junk folder).', unconfirmed: true });
    } catch (error) {
      if (isAlreadyRegisteredError(error)) return setStatus({ loading: false, error: '', success: 'Your email is already confirmed. Please log in.', unconfirmed: false });
      setStatus({ loading: false, error: friendlyAuthError(error), success: '', unconfirmed: true });
    }
  };

  return (
    <>
      <SEO title="Log in | Unboxed Together" description="Log in to your Unboxed Together member account." path="/login" />
      <AuthShell eyebrow="Member access" title="Welcome back" intro="Pick up where you left off with the additive library and your own starting point." footer={<p>New here? <Link href="/signup">Join free</Link></p>}>
        <form className="auth-form" onSubmit={submit}>
          <FormMessage error={status.error} success={status.success || (router.query.expired && !status.error ? 'Your session has ended. Please log in again to continue.' : '')} />
          {status.unconfirmed && <button className="member-button secondary" type="button" onClick={resendConfirmation} disabled={status.loading || !form.email || !form.password}>Send me a new confirmation link</button>}
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
