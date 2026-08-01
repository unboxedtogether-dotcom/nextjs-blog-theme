import { useState } from 'react';
import { useRouter } from 'next/router';
import { updateUser } from '@netlify/identity';
import AuthShell from '../components/auth/AuthShell';
import FormMessage from '../components/auth/FormMessage';
import SEO from '../components/SEO';
import { friendlyAuthError } from '../utils/auth-errors';

export default function ResetPassword() {
  const router = useRouter();
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [status, setStatus] = useState({ loading: false, error: '', success: '' });
  const submit = async (event) => {
    event.preventDefault();
    if (form.password !== form.confirm) return setStatus({ loading: false, error: 'The passwords do not match.', success: '' });
    setStatus({ loading: true, error: '', success: '' });
    try {
      await updateUser({ password: form.password });
      setStatus({ loading: false, error: '', success: 'Your password has been updated. Taking you to your account…' });
      setTimeout(() => router.replace('/members'), 900);
    } catch (error) { setStatus({ loading: false, error: friendlyAuthError(error), success: '' }); }
  };
  return <><SEO title="Choose a new password | Unboxed Together" description="Set a new password for your account." path="/reset-password" /><AuthShell eyebrow="Secure reset" title="Choose a new password" intro="Use a password you do not use elsewhere."><form className="auth-form" onSubmit={submit}><FormMessage error={status.error} success={status.success} /><label htmlFor="password">New password</label><input id="password" type="password" minLength="8" required autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><label htmlFor="confirm">Confirm new password</label><input id="confirm" type="password" minLength="8" required autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} /><button className="member-button" disabled={status.loading}>{status.loading ? 'Updating…' : 'Update password'}</button></form></AuthShell></>;
}
