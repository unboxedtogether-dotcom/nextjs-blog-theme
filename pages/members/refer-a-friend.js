import { useState } from 'react';
import Link from 'next/link';
import Layout from '../../components/Layout';
import SEO from '../../components/SEO';
import BrandLoader from '../../components/BrandLoader';
import FormMessage from '../../components/auth/FormMessage';
import { useMemberData } from '../../utils/use-member-data';

const seo = <SEO title="Refer a friend | Unboxed Together" description="Invite a friend to Unboxed Together." path="/members/refer-a-friend" />;

export default function ReferAFriend() {
  const { data, loading, error } = useMemberData('/api/member/refer');
  const [form, setForm] = useState({ friendName: '', email: '' });
  const [status, setStatus] = useState({ busy: false, error: '', success: '' });
  const [sent, setSent] = useState(0);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const send = async (event) => {
    event.preventDefault();
    if (!form.email.trim()) return setStatus({ busy: false, error: 'Please enter your friend’s email address.', success: '' });
    setStatus({ busy: true, error: '', success: '' });
    try {
      const response = await fetch('/api/member/refer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Your invitation could not be sent.');
      setSent((count) => count + 1);
      setForm({ friendName: '', email: '' });
      setStatus({
        busy: false,
        error: '',
        success: result.delivery ? 'Thank you! Your invitation is on its way.' : 'Thank you! Your invitation has been saved and will be emailed shortly.',
      });
    } catch (sendError) {
      setStatus({ busy: false, error: sendError.message, success: '' });
    }
    return undefined;
  };

  let body;
  if (error) body = <p className="onboarding-error" role="alert">{error}</p>;
  else if (loading || !data) body = <BrandLoader label="Loading…" />;
  else {
    body = (
      <section className="profile-panel" aria-labelledby="refer-heading">
        <h2 id="refer-heading">Send an invitation</h2>
        <p>Enter your friend’s email address and we will send them a one-off email from Unboxed Together, with your first name and a link to our <Link href="/join-us?preview=friend">Join us</Link> page (tap it to see exactly what they will see).</p>
        <form className="contact-form" onSubmit={send}>
          <div className="profile-field">
            <label htmlFor="refer-name">Friend’s first name <span className="settings-note">(optional)</span></label>
            <input id="refer-name" value={form.friendName} onChange={set('friendName')} maxLength={40} autoComplete="off" />
          </div>
          <div className="profile-field">
            <label htmlFor="refer-email">Friend’s email address</label>
            <input id="refer-email" type="email" value={form.email} onChange={set('email')} maxLength={254} autoComplete="off" required />
          </div>
          <p className="settings-note">Please only invite people you know who would be happy to hear from us. We use their address just for this email and never add them to a mailing list.</p>
          <FormMessage error={status.error} success={status.success} />
          <button className="member-button" type="submit" disabled={status.busy}>{status.busy ? 'Sending…' : 'Send invitation'}</button>
        </form>
        {data.sentThisMonth + sent > 0 && <p className="settings-note">You have sent {data.sentThisMonth + sent} {data.sentThisMonth + sent === 1 ? 'invitation' : 'invitations'} in the last 30 days. Thank you for spreading the word.</p>}
      </section>
    );
  }

  return (
    <Layout>
      {seo}
      <div className="member-page profile-page">
        <header className="member-hero compact">
          <p className="member-kicker">Your account</p>
          <h1>Refer a friend</h1>
          <p>Know someone who would enjoy Unboxed Together? Invite them to find out more. <Link className="hero-link" href="/members">← Back to my dashboard</Link></p>
        </header>
        <div className="settings-stack">{body}</div>
      </div>
    </Layout>
  );
}
