import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { signup } from '@netlify/identity';
import AuthShell from '../components/auth/AuthShell';
import FormMessage from '../components/auth/FormMessage';
import SEO from '../components/SEO';
import { useAuth } from '../components/auth/AuthProvider';
import { friendlyAuthError } from '../utils/auth-errors';

export default function Signup() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', accepted: false, marketing: false });
  const [status, setStatus] = useState({ loading: false, error: '', success: '' });

  useEffect(() => { if (!loading && user) router.replace('/members'); }, [loading, user, router]);

  const submit = async (event) => {
    event.preventDefault();
    if (!form.accepted) return setStatus({ loading: false, error: 'Please agree to the Privacy Policy and Terms to create an account.', success: '' });
    setStatus({ loading: true, error: '', success: '' });
    try {
      const created = await signup(form.email.trim(), form.password, {
        full_name: form.name.trim(),
        marketing_consent: form.marketing,
      });
      if (created.emailVerified) window.location.href = '/onboarding';
      else setStatus({ loading: false, error: '', success: 'Check your inbox to confirm your email. The link brings you back to finish setting up your account.' });
    } catch (error) {
      setStatus({ loading: false, error: friendlyAuthError(error), success: '' });
    }
  };

  return (
    <>
      <SEO title="Join Unboxed Together" description="Create your free Unboxed Together member account." path="/signup" />
      <AuthShell eyebrow="Free membership" title="Start your Unboxed journey" intro="Create your free account to search additives, understand ingredients and begin tracking what changes for you." footer={<p>Already a member? <Link href="/login">Log in</Link></p>}>
        <form className="auth-form" onSubmit={submit} noValidate>
          <FormMessage error={status.error} success={status.success} />
          <label htmlFor="name">Your name</label>
          <input id="name" name="name" required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <label htmlFor="email">Email address</label>
          <input id="email" name="email" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <label htmlFor="password">Choose a password</label>
          <input id="password" name="password" type="password" minLength="8" required autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <p className="field-help">Use at least 8 characters.</p>
          <label className="check-row">
            <input type="checkbox" checked={form.accepted} onChange={(e) => setForm({ ...form, accepted: e.target.checked })} />
            <span>I agree to the <Link href="/privacy">Privacy Policy</Link> and <Link href="/terms">Terms</Link>.</span>
          </label>
          <label className="check-row">
            <input type="checkbox" checked={form.marketing} onChange={(e) => setForm({ ...form, marketing: e.target.checked })} />
            <span>Send me occasional Unboxed Together updates and practical food-awareness resources. Optional.</span>
          </label>
          <button className="member-button" type="submit" disabled={status.loading}>{status.loading ? 'Creating your account…' : 'Join free'}</button>
          <p className="privacy-short">Your account information is used to provide membership features. Onboarding answers help personalise your experience and are not labelled as medical records.</p>
        </form>
      </AuthShell>
    </>
  );
}
