import { useEffect, useState } from 'react';

const formatDate = (value) => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

// Offers to link an earlier /join-us interest form sent with this account's
// verified email. Nothing is linked until the member confirms, and the
// answers stay in the separate interest record.
export default function InterestLinkCard() {
  const [state, setState] = useState({ linked: [], available: [], error: '' });

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/member/interest', { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => { if (data) setState({ linked: data.linked, available: data.available, error: '' }); })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const act = async (action, id) => {
    const response = await fetch('/api/member/interest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, id }) });
    const data = await response.json().catch(() => ({}));
    setState(response.ok ? { linked: data.linked, available: data.available, error: '' } : (current) => ({ ...current, error: data.error || 'That could not be changed.' }));
  };

  if (!state.linked.length && !state.available.length) return null;
  return (
    <section className="dashboard-card" aria-labelledby="interest-link-heading">
      <span>Earlier interest form</span>
      <h2 id="interest-link-heading">{state.available.length ? 'Was this you?' : 'Linked interest form'}</h2>
      {state.available.map((item) => (
        <div key={item.id} className="interest-link">
          <p>An interest form was sent from unboxedtogether.com/join-us on {formatDate(item.submitted_at)} using your email address. If it was you, you can link it to your account so we know you have joined.</p>
          <p className="dashboard-note">Your answers stay separate from your welcome form and are not copied into your member records.</p>
          <button className="member-button" type="button" onClick={() => act('link', item.id)}>Yes, link it to my account</button>
        </div>
      ))}
      {state.linked.map((item) => (
        <div key={item.id} className="interest-link">
          <p>Your interest form from {formatDate(item.submitted_at)} is linked to your account.</p>
          <button className="text-button" type="button" onClick={() => act('unlink', item.id)}>Unlink it</button>
        </div>
      ))}
      {state.error && <p className="onboarding-error" role="alert">{state.error}</p>}
    </section>
  );
}
