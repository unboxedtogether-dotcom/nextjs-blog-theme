import { useState } from 'react';
import Link from 'next/link';
import { requestPasswordRecovery } from '@netlify/identity';
import AuthShell from '../components/auth/AuthShell';
import FormMessage from '../components/auth/FormMessage';
import SEO from '../components/SEO';
import { friendlyAuthError } from '../utils/auth-errors';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState({ loading: false, error: '', success: '' });
  const submit = async (event) => {
    event.preventDefault();
    setStatus({ loading: true, error: '', success: '' });
    try {
      await requestPasswordRecovery(email.trim());
      setStatus({ loading: false, error: '', success: 'If an account exists for that email, a secure reset link is on its way.' });
    } catch (error) {
      setStatus({ loading: false, error: friendlyAuthError(error), success: '' });
    }
  };
  return <><SEO title="Reset your password | Unboxed Together" description="Request a secure password reset link." path="/forgot-password" /><AuthShell eyebrow="Account help" title="Let’s get you back in" intro="Enter your email and we’ll send a secure password reset link." footer={<p>Remembered it? <Link href="/login">Return to log in</Link></p>}><form className="auth-form" onSubmit={submit}><FormMessage error={status.error} success={status.success} /><label htmlFor="email">Email address</label><input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /><button className="member-button" disabled={status.loading}>{status.loading ? 'Sending…' : 'Send reset link'}</button></form></AuthShell></>;
}
