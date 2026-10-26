import { useState } from 'react';
import Link from 'next/link';
import Layout from '../../components/Layout';
import SEO from '../../components/SEO';
import BrandLoader from '../../components/BrandLoader';
import FormMessage from '../../components/auth/FormMessage';
import { StatusPill } from '../../components/members/AdminUi';
import { useMemberData } from '../../utils/use-member-data';
import { REFERRAL_SUBJECT, referralInvitationText } from '../../utils/referral-invitation.mjs';

const seo = <SEO title="Refer a friend | Unboxed Together" description="Invite a friend to Unboxed Together." path="/members/refer-a-friend" />;
const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const stages = {
  awaiting_sharing: ['grey', 'Ready to share'],
  shared: ['amber', 'Shared'],
  opened: ['blue', 'Link opened'],
  registered: ['green', 'Joined'],
  onboarded: ['green', 'Joined and set up'],
};

function ShareInvitation({ referral, referrerName, onShared }) {
  const [copied, setCopied] = useState('');
  const text = referralInvitationText({ referrerName: referral.share_referrer_name ? referrerName : '', url: referral.url });
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const copy = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      onShared(referral.id, 'copy');
    } catch {
      setCopied('Select the link and copy it');
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title: REFERRAL_SUBJECT, text, url: referral.url });
      onShared(referral.id, 'native_share');
    } catch {
      // Cancelled by the member; nothing to record.
    }
  };
  const mailto = `mailto:${referral.recipient_email ? encodeURIComponent(referral.recipient_email) : ''}?subject=${encodeURIComponent(REFERRAL_SUBJECT)}&body=${encodeURIComponent(text)}`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(text)}`;

  return (
    <div>
      <div className="referral-link">
        <label className="sr-only" htmlFor={`link-${referral.id}`}>Your personal invitation link</label>
        <input id={`link-${referral.id}`} className="wq-input" readOnly value={referral.url} onFocus={(event) => event.target.select()} />
        <button className="member-button" type="button" onClick={() => copy(referral.url, 'Link copied')}>Copy link</button>
      </div>
      <div className="referral-share">
        {canShare && <button className="member-button secondary" type="button" onClick={share}>Share…</button>}
        <a className="member-button secondary" href={mailto} onClick={() => onShared(referral.id, 'email_app')}>Send from my email</a>
        <a className="member-button secondary" href={whatsapp} target="_blank" rel="noopener noreferrer" onClick={() => onShared(referral.id, 'whatsapp')}>WhatsApp</a>
        <button className="member-button secondary" type="button" onClick={() => copy(text, 'Message copied')}>Copy message</button>
      </div>
      {copied && <p className="settings-note" role="status">{copied}</p>}
      <details>
        <summary className="text-button inline">See the message your friend will get</summary>
        <div className="referral-preview">{text}</div>
      </details>
    </div>
  );
}

export default function ReferAFriend() {
  const { data, loading, error } = useMemberData('/api/member/refer');
  const [form, setForm] = useState({ friendName: '', email: '', shareName: true });
  const [status, setStatus] = useState({ busy: false, error: '', success: '' });
  const [latest, setLatest] = useState(null);
  const [list, setList] = useState(null);

  const referrals = list || data?.referrals || [];
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: key === 'shareName' ? event.target.checked : event.target.value }));

  const create = async (event) => {
    event.preventDefault();
    setStatus({ busy: true, error: '', success: '' });
    try {
      const response = await fetch('/api/member/refer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Your invitation could not be created.');
      setList(result.referrals);
      setLatest(result.referral);
      setForm({ friendName: '', email: '', shareName: form.shareName });
      setStatus({ busy: false, error: '', success: result.duplicate ? 'You have already invited this friend, so here is the same link again.' : 'Your personal invitation link is ready. Share it with your friend below.' });
    } catch (createError) {
      setStatus({ busy: false, error: createError.message, success: '' });
    }
  };

  const markShared = async (id, via) => {
    const response = await fetch('/api/member/refer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'shared', id, via }) }).catch(() => null);
    const result = await response?.json().catch(() => null);
    if (response?.ok && result?.referrals) setList(result.referrals);
  };

  let body;
  if (error) body = <p className="onboarding-error" role="alert">{error}</p>;
  else if (loading || !data) body = <BrandLoader label="Loading…" />;
  else {
    const name = data.preferredName;
    body = (
      <>
        <section className="profile-panel" aria-labelledby="refer-heading">
          <h2 id="refer-heading">Create an invitation</h2>
          <p>You will get a personal link to send your friend yourself, by message, email or however you like. When they open it they will see our <Link href="/join-us?preview=friend">Join us</Link> page (tap to see exactly what they see), and if they join we will know you invited them.</p>
          <form className="contact-form" onSubmit={create}>
            <div className="profile-field">
              <label htmlFor="refer-name">Friend’s first name <span className="settings-note">(optional, only for your list)</span></label>
              <input id="refer-name" value={form.friendName} onChange={set('friendName')} maxLength={40} autoComplete="off" />
            </div>
            <div className="profile-field">
              <label htmlFor="refer-email">Friend’s email address <span className="settings-note">(optional)</span></label>
              <input id="refer-email" type="email" value={form.email} onChange={set('email')} maxLength={254} autoComplete="off" />
            </div>
            <label className="wq-checkbox">
              <input type="checkbox" checked={form.shareName} onChange={set('shareName')} />
              <span>Show my first name{name ? ` (${name})` : ''} on the invitation, so my friend knows it is from me.</span>
            </label>
            <p className="settings-note">We do not send marketing emails to people just because a member gave us their address. Your friend’s email, if you add it, is only used to recognise them if they join, and to email them the invitation only if they have already told us they are happy to hear from Unboxed Together. Please only invite people you know.</p>
            <FormMessage error={status.error} success={status.success} />
            <button className="member-button" type="submit" disabled={status.busy || data.remainingToday === 0}>{status.busy ? 'Creating…' : 'Create my invitation link'}</button>
            {data.remainingToday === 0 && <p className="settings-note">You have created several invitations today. Thank you! You can create more tomorrow, or share one of your existing links.</p>}
          </form>
          {latest && <ShareInvitation referral={latest} referrerName={name} onShared={markShared} />}
        </section>

        <section className="profile-panel" aria-labelledby="my-invitations">
          <h2 id="my-invitations">My invitations</h2>
          {referrals.length ? (
            <ul className="referral-list">
              {referrals.map((item) => {
                const [tone, label] = stages[item.stage] || stages.awaiting_sharing;
                return (
                  <li key={item.id}>
                    <div><strong>{item.recipient_name || item.recipient_email || 'Invitation link'}</strong><br /><small>Created {formatDate(item.created_at)}</small></div>
                    <div><StatusPill tone={tone}>{label}</StatusPill>{' '}
                      <button className="text-button inline" type="button" onClick={() => setLatest(item)}>Share again</button></div>
                  </li>
                );
              })}
            </ul>
          ) : <p>You have not invited anyone yet.</p>}
          <p className="settings-note">“Link opened” means someone opened your link. “Joined” means your friend created an account using it.</p>
        </section>
      </>
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
