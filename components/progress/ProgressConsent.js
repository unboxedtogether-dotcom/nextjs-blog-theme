import { useState } from 'react';
import Link from 'next/link';
import { privacyContactEmail, privacyNoticePath } from '../../utils/welcome-questionnaire.mjs';
import { progressConsent } from '../../utils/progress-checkin.mjs';

const post = async (body) => {
  const response = await fetch('/api/progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'That could not be saved. Please try again.');
  return data;
};

// Separate, explicit consent (UK GDPR Article 9) before any progress answers are stored.
export function ProgressConsentForm({ onGiven }) {
  const [ticked, setTicked] = useState(false);
  const [status, setStatus] = useState({ saving: false, error: '' });
  const give = async (event) => {
    event.preventDefault();
    if (!ticked) return setStatus({ saving: false, error: 'Please tick the box to start progress tracking, or choose not now.' });
    setStatus({ saving: true, error: '' });
    try {
      onGiven((await post({ action: 'consent', consent: true })).state);
    } catch (error) {
      setStatus({ saving: false, error: error.message });
    }
  };
  return (
    <form className="progress-consent" onSubmit={give}>
      <h2>{progressConsent.heading}</h2>
      <ul>{progressConsent.points.map((point) => <li key={point}>{point}</li>)}</ul>
      <p>Read the full <Link href={privacyNoticePath}>Privacy Policy</Link> or contact <a href={`mailto:${privacyContactEmail}`}>{privacyContactEmail}</a> with any questions.</p>
      <label className="wq-checkbox progress-consent__box">
        <input type="checkbox" checked={ticked} onChange={(event) => setTicked(event.target.checked)} />
        <span>{progressConsent.label}</span>
      </label>
      {status.error && <p className="onboarding-error" role="alert">{status.error}</p>}
      <div className="card-actions">
        <button className="member-button" type="submit" disabled={status.saving}>{status.saving ? 'Saving…' : 'Give consent and continue'}</button>
        <Link className="member-button secondary link-button" href="/members">Not now</Link>
      </div>
    </form>
  );
}

export function ProgressConsentManager({ consent, onWithdrawn }) {
  const [confirmation, setConfirmation] = useState('');
  const [status, setStatus] = useState({ saving: false, error: '' });
  if (!consent.given) return null;
  const withdraw = async (event) => {
    event.preventDefault();
    setStatus({ saving: true, error: '' });
    try {
      onWithdrawn((await post({ action: 'withdraw', confirmation })).state);
    } catch (error) {
      setStatus({ saving: false, error: error.message });
    }
  };
  return (
    <details className="profile-panel progress-consent-manager">
      <summary>Your consent and your data</summary>
      <p>You gave consent for personal progress tracking on {new Date(consent.givenAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}. Your records are kept while your membership is active, and you can download them at any time from My forms &amp; assessments.</p>
      <form onSubmit={withdraw}>
        <h3>Withdraw consent and delete my progress records</h3>
        <p>This stops tracking and permanently deletes your baseline, every weekly check-in, your scores and your progress notes. Your welcome questionnaire is not affected. This cannot be undone, so download your report first if you want a copy.</p>
        <label className="wq-field"><span>Type DELETE MY PROGRESS to confirm</span><input className="wq-input" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" /></label>
        {status.error && <p className="onboarding-error" role="alert">{status.error}</p>}
        <button className="member-button danger-button" type="submit" disabled={status.saving || confirmation !== 'DELETE MY PROGRESS'}>{status.saving ? 'Deleting…' : 'Withdraw and delete'}</button>
      </form>
    </details>
  );
}
