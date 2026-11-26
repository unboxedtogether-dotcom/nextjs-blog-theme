import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { signup } from '@netlify/identity';
import AuthShell from '../components/auth/AuthShell';
import FormMessage from '../components/auth/FormMessage';
import SEO from '../components/SEO';
import { useAuth } from '../components/auth/AuthProvider';
import { friendlyAuthError, isAlreadyRegisteredError } from '../utils/auth-errors';
import { rememberAccount } from '../utils/member-cookie';

export default function Signup() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', accepted: false, marketing: false });
  const [status, setStatus] = useState({ loading: false, error: '', success: '' });
  // Set once the account is created and is waiting for its email to be confirmed.
  const [sentTo, setSentTo] = useState('');

  useEffect(() => { if (!loading && user) router.replace('/members'); }, [loading, user, router]);

  const submit = async (event) => {
    event.preventDefault();
    if (!form.accepted) return setStatus({ loading: false, error: 'Please agree to the Privacy Policy and Terms to create an account.', success: '' });
    setStatus({ loading: true, error: '', success: '' });
    try {
      // A member's invitation token, if the visitor came from one, so the
      // referral is credited once the email is confirmed.
      const ref = typeof router.query.ref === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(router.query.ref) ? router.query.ref : '';
      const created = await signup(form.email.trim(), form.password, {
        full_name: form.name.trim(),
        marketing_consent: form.marketing,
        ...(ref ? { referral_token: ref } : {}),
      });
      rememberAccount();
      if (created.emailVerified) {
        window.location.href = '/onboarding';
        return;
      }
      setStatus({ loading: false, error: '', success: '' });
      setSentTo(form.email.trim());
      window.scrollTo?.({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setStatus({ loading: false, error: friendlyAuthError(error), success: '', existing: isAlreadyRegisteredError(error) });
    }
  };

  if (sentTo) {
    return <CheckInbox email={sentTo} password={form.password} name={form.name.trim()} marketing={form.marketing} referral={typeof router.query.ref === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(router.query.ref) ? router.query.ref : ''} onChangeEmail={() => { setSentTo(''); setForm({ ...form, password: '' }); }} />;
  }

  return (
    <>
      <SEO title="Join Unboxed Together" description="Create your free Unboxed Together member account." path="/signup" />
      <AuthShell badge="Free membership" title="Start your Unboxed journey" intro="Membership is completely free. Create your account to search additives, understand ingredients and begin tracking what changes for you." footer={<><p>Already a member? <Link href="/login">Log in</Link></p><p className="auth-skip"><Link href="/home">Skip for now and explore the website</Link>. You can join later.</p></>}>
        <form className="auth-form" onSubmit={submit} noValidate>
          <FormMessage error={status.error} success={status.success} />
          {status.existing && <p className="field-help"><Link href="/login">Log in</Link> · <Link href="/forgot-password">Reset your password</Link></p>}
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
          <button className="member-button" type="submit" disabled={status.loading}>{status.loading ? 'Creating your free account…' : 'Create my free account'}</button>
          <p className="privacy-short">Your account information is used to provide membership features. Onboarding answers help personalise your experience and are not labelled as medical records.</p>
        </form>
      </AuthShell>
    </>
  );
}

// Shown after signing up while the account waits for its email to be
// confirmed. Signing up again with the same details asks Identity to send a
// fresh confirmation link; Identity quietly skips it if one went out in the
// last 15 minutes (or three already went out today), so the wording here
// never promises that a new email was sent.
function CheckInbox({ email, password, name, marketing, referral, onChangeEmail }) {
  const [resend, setResend] = useState({ loading: false, error: '', success: '' });
  const resendEmail = async () => {
    setResend({ loading: true, error: '', success: '' });
    try {
      const again = await signup(email, password, { full_name: name, marketing_consent: marketing, ...(referral ? { referral_token: referral } : {}) });
      if (again.emailVerified) {
        window.location.href = '/onboarding';
        return;
      }
      setResend({ loading: false, error: '', success: 'If your account still needs confirming, a new link is on its way. Only one email can be sent every 15 minutes, so please also check for the earlier one.' });
    } catch (error) {
      if (isAlreadyRegisteredError(error)) {
        setResend({ loading: false, error: '', success: 'Your email is already confirmed. You can log in now.' });
        return;
      }
      setResend({ loading: false, error: friendlyAuthError(error), success: '' });
    }
  };

  return (
    <>
      <SEO title="Check your inbox | Unboxed Together" description="Confirm your email to finish creating your free Unboxed Together account." path="/signup" />
      <AuthShell badge="Free membership" title="Check your inbox" intro="One last step: confirm your email address to activate your free account." footer={<p>Already confirmed? <Link href="/login">Log in</Link></p>}>
        <div className="auth-form" role="status">
          <FormMessage error={resend.error} success={resend.success} />
          <p>We have sent a confirmation link to <strong>{email}</strong>.</p>
          <ol className="auth-steps">
            <li>Open the email from Unboxed Together. It usually arrives within a couple of minutes.</li>
            <li>Click <strong>Verify my email</strong>. The link brings you back here, signed in, to finish setting up your account.</li>
          </ol>
          <p className="field-help">Can't see it? Check your spam, junk or promotions folder. Some email providers take up to 10 minutes.</p>
          <button className="member-button secondary" type="button" onClick={resendEmail} disabled={resend.loading}>{resend.loading ? 'Sending…' : 'Resend confirmation email'}</button>
          <button className="text-button" type="button" onClick={onChangeEmail}>Wrong email address? Go back and change it</button>
        </div>
      </AuthShell>
    </>
  );
}
