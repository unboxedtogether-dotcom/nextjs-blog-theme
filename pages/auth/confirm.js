import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { handleAuthCallback } from '@netlify/identity';
import AuthShell from '../../components/auth/AuthShell';
import FormMessage from '../../components/auth/FormMessage';
import SEO from '../../components/SEO';
import { friendlyAuthError } from '../../utils/auth-errors';

export default function ConfirmAuth() {
  const router = useRouter();
  const [error, setError] = useState('');
  useEffect(() => {
    handleAuthCallback().then((result) => {
      if (!result) return router.replace('/login');
      if (result.type === 'recovery') return router.replace('/reset-password');
      return router.replace('/onboarding');
    }).catch((callbackError) => setError(friendlyAuthError(callbackError)));
  }, [router]);
  return <><SEO title="Confirming your account | Unboxed Together" description="Securely confirming your Unboxed Together account." path="/auth/confirm" /><AuthShell eyebrow="Nearly there" title="Confirming your account" intro="This usually takes only a moment."><FormMessage error={error} /><div className="auth-loading" role="status">Checking your secure link…</div></AuthShell></>;
}
