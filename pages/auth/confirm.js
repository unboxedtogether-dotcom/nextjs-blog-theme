import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { acceptInvite, handleAuthCallback } from '@netlify/identity';
import AuthShell from '../../components/auth/AuthShell';
import FormMessage from '../../components/auth/FormMessage';
import SEO from '../../components/SEO';
import { friendlyAuthError } from '../../utils/auth-errors';

// Every Identity email link lands here. Signed-in members then go to
// /members, which opens the welcome form only if it is still unfinished.
export default function ConfirmAuth() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  useEffect(() => {
    handleAuthCallback().then((result) => {
      if (!result) return router.replace('/login');
      if (result.type === 'recovery') return router.replace('/reset-password');
      if (result.type === 'invite') return setInviteToken(result.token);
      return router.replace('/members');
    }).catch((callbackError) => setError(friendlyAuthError(callbackError)));
  }, [router]);

  if (inviteToken) return <AcceptInvite token={inviteToken} />;
  return <><SEO title="Confirming your account | Unboxed Together" description="Securely confirming your Unboxed Together account." path="/auth/confirm" /><AuthShell eyebrow="Nearly there" title="Confirming your account" intro="This usually takes only a moment."><FormMessage error={error} />{!error && <div className="auth-loading" role="status">Checking your secure link…</div>}</AuthShell></>;
}

function AcceptInvite({ token }) {
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [status, setStatus] = useState({ loading: false, error: '' });
  const submit = async (event) => {
    event.preventDefault();
    if (form.password !== form.confirm) return setStatus({ loading: false, error: 'The passwords do not match.' });
    setStatus({ loading: true, error: '' });
    try {
      await acceptInvite(token, form.password);
      window.location.replace('/members');
    } catch (inviteError) {
      setStatus({ loading: false, error: friendlyAuthError(inviteError) });
    }
  };
  return (
    <>
      <SEO title="Accept your invitation | Unboxed Together" description="Choose a password to finish setting up your Unboxed Together account." path="/auth/confirm" />
      <AuthShell eyebrow="You're invited" title="Choose your password" intro="Set a password to finish creating your free Unboxed Together account.">
        <form className="auth-form" onSubmit={submit}>
          <FormMessage error={status.error} />
          <label htmlFor="password">Choose a password</label>
          <input id="password" type="password" minLength="8" required autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <label htmlFor="confirm">Confirm password</label>
          <input id="confirm" type="password" minLength="8" required autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
          <button className="member-button" type="submit" disabled={status.loading}>{status.loading ? 'Setting up…' : 'Create my account'}</button>
        </form>
      </AuthShell>
    </>
  );
}
