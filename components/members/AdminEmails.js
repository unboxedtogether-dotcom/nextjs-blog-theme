import { Fragment, useCallback, useEffect, useState } from 'react';
import BrandLoader from '../BrandLoader';
import { emailStatusLabels, emailStatusTone } from '../../utils/member-status.mjs';
import { StatusPill, formatDateTime, postJson, readJson } from './AdminUi';

const kindLabels = {
  welcome_reminder: 'Welcome form reminder', checkin_reminder: 'Weekly check-in reminder', baseline_reminder: 'Onboarding reminder',
  member_welcome: 'Welcome email', friend_referral: 'Referral invitation', interest_confirmation: 'Interest confirmation',
};
const statusOptions = [['', 'Any status'], ['pending', 'Awaiting dispatch'], ['accepted', 'Accepted by provider'], ['delivered', 'Delivered (confirmed)'], ['failed', 'Failed or bounced'], ['closed', 'Cancelled or expired']];
const kindOptions = [['', 'All emails'], ['reminders', 'All reminders'], ['checkin', 'Weekly check-in reminders'], ['welcome', 'Welcome form reminders'], ['baseline', 'Onboarding reminders'], ['referrals', 'Referral invitations'], ['welcome_email', 'Welcome emails'], ['prospects', 'Interest confirmations']];

function History({ id }) {
  const [state, setState] = useState({ loading: true, error: '', data: null });
  useEffect(() => {
    fetch(`/api/admin/emails?email=${encodeURIComponent(id)}`)
      .then((response) => readJson(response, 'The history could not be loaded.'))
      .then((data) => setState({ loading: false, error: '', data }))
      .catch((error) => setState({ loading: false, error: error.message, data: null }));
  }, [id]);
  if (state.loading) return <p role="status">Loading history…</p>;
  if (state.error) return <p className="onboarding-error" role="alert">{state.error}</p>;
  const { email, events } = state.data;
  return (
    <div className="admin-email-history">
      <dl className="submission-meta">
        <div><dt>Attempts</dt><dd>{email.attempts}</dd></div>
        <div><dt>Manual retries</dt><dd>{email.retry_count}</dd></div>
        <div><dt>Provider</dt><dd>{email.provider || '—'}</dd></div>
        <div><dt>Provider message id</dt><dd>{email.provider_message_id || '—'}</dd></div>
      </dl>
      <ol className="admin-timeline">{events.map((event, index) => <li key={index}><time dateTime={event.occurred_at}>{formatDateTime(event.occurred_at)}</time> {event.event_type}{event.detail ? ` — ${event.detail}` : ''}</li>)}</ol>
    </div>
  );
}

// Emails & reminders: everything in the outbox with its real delivery state.
// Retrying re-checks on the server that the email is still wanted.
export default function AdminEmails({ initialFilters = {}, onOpenMember }) {
  const [filters, setFilters] = useState({ status: '', kind: '', q: '', page: 1, ...initialFilters });
  const [term, setTerm] = useState('');
  const [state, setState] = useState({ loading: true, error: '', data: null });
  const [open, setOpen] = useState('');
  const [notice, setNotice] = useState({ id: '', text: '', error: false });

  const load = useCallback(() => {
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value).map(([key, value]) => [key, String(value)]));
    fetch(`/api/admin/emails?${params}`)
      .then((response) => readJson(response, 'Emails could not be loaded.'))
      .then((data) => setState({ loading: false, error: '', data }))
      .catch((error) => setState({ loading: false, error: error.message, data: null }));
  }, [filters]);
  useEffect(() => { load(); }, [load]);
  const refresh = () => {
    setState((current) => ({ ...current, loading: true }));
    load();
  };

  const retry = async (id) => {
    if (!window.confirm('Try sending this email again? It is checked again first and cancelled if it is no longer needed.')) return;
    setNotice({ id, text: 'Retrying…', error: false });
    try {
      const data = await readJson(await postJson('/api/admin/emails', { action: 'retry', id }), 'The email could not be retried.');
      setNotice({ id, text: data.deliveryConfigured ? `Now: ${emailStatusLabels[data.email.status]}.` : 'Queued again. Email delivery is not configured.', error: false });
    } catch (error) {
      setNotice({ id, text: error.message, error: true });
    }
    load();
  };
  const set = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value, page: 1 }));

  if (state.loading && !state.data) return <BrandLoader label="Loading emails…" />;
  if (state.error) return <p className="onboarding-error" role="alert">{state.error}</p>;
  const { stats, emails, deliveryConfigured, webhookConfigured } = state.data;
  const tiles = [
    ['Awaiting dispatch', stats.pending, { status: 'pending' }],
    ['Accepted by provider', stats.accepted, { status: 'accepted' }],
    ['Delivered (confirmed)', stats.delivered, { status: 'delivered' }],
    ['Failed or bounced', stats.failed, { status: 'failed' }],
    ['Weekly check-in reminders', stats.checkin_reminders, { kind: 'checkin' }],
    ['Welcome and onboarding reminders', stats.onboarding_reminders, { kind: 'reminders' }],
    ['Referral invitations', stats.referral_invitations, { kind: 'referrals' }],
  ];

  return (
    <div className="admin-progress">
      <section className="profile-panel">
        <div className="admin-panel-head">
          <h2>Emails &amp; reminders</h2>
          <button className="member-button secondary" type="button" onClick={refresh} disabled={state.loading}>{state.loading ? 'Refreshing…' : 'Refresh'}</button>
        </div>
        <p>Every email the site has queued, with its real status. “Accepted by provider” means the email service took the message; “Delivered” is only shown once the provider confirms delivery.</p>
        {!deliveryConfigured && <p className="admin-consent">Email delivery is not configured, so emails wait in the queue. Queued emails expire after 7 days rather than being sent late.</p>}
        {deliveryConfigured && !webhookConfigured && <p className="dashboard-note">Delivery confirmations and bounces are not being received (no webhook signing secret).</p>}
        <ul className="admin-tiles is-interactive">{tiles.map(([label, value, next]) => (
          <li key={label}><button type="button" onClick={() => setFilters({ status: '', kind: '', q: '', page: 1, ...next })}><strong>{value}</strong><span>{label}</span></button></li>
        ))}</ul>
        <p className="dashboard-note">Communication preferences: {stats.preferences.marketing} of {stats.preferences.members} members opted in to marketing · {stats.preferences.reminders_paused} turned reminder emails off · {stats.preferences.suppressed} addresses suppressed after an unsubscribe, bounce or complaint. Members who need follow-up can be found in Members with the “Not responded to a reminder” or “Email failed or bounced” filters.</p>
      </section>

      <section className="profile-panel">
        <h2>{state.data.total} {state.data.total === 1 ? 'email' : 'emails'}</h2>
        <form className="admin-search" role="search" onSubmit={(event) => { event.preventDefault(); setFilters((current) => ({ ...current, q: term.trim(), page: 1 })); }}>
          <label className="sr-only" htmlFor="email-search">Search by recipient or member name</label>
          <input id="email-search" className="wq-input" type="search" value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Search by recipient or member name" />
          <button className="member-button" type="submit">Search</button>
        </form>
        <div className="admin-search">
          <select className="wq-input" aria-label="Status" value={filters.status} onChange={set('status')}>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <select className="wq-input" aria-label="Email type" value={filters.kind} onChange={set('kind')}>{kindOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Email</th><th>Recipient</th><th>Requested</th><th>Requested by</th><th>Status</th><th>Detail</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {emails.map((item) => (
                <Fragment key={item.id}>
                  <tr>
                    <td>{kindLabels[item.kind] || item.kind}<small>Template {item.template_version}{item.week ? ` · week of ${item.week}` : ''}</small></td>
                    <td className="admin-table__member">{item.member_name && item.user_id ? <button className="text-button inline" type="button" onClick={() => onOpenMember(item.user_id)}>{item.member_name}</button> : null}<small>{item.to_email}</small></td>
                    <td>{formatDateTime(item.created_at)}</td>
                    <td>{item.requested_by_name || (item.requested_by?.startsWith('member:') ? 'Member' : item.requested_by === 'system' ? 'Automatic' : 'Admin')}</td>
                    <td><StatusPill tone={emailStatusTone[item.status]}>{emailStatusLabels[item.status]}</StatusPill></td>
                    <td>{item.last_error || (item.delivered_at ? `Delivered ${formatDateTime(item.delivered_at)}` : item.sent_at ? `Accepted ${formatDateTime(item.sent_at)}` : '—')}
                      {notice.id === item.id && <small className={notice.error ? 'onboarding-error' : ''} role="status">{notice.text}</small>}</td>
                    <td><div className="admin-table__actions">
                      <button className="text-button" type="button" onClick={() => setOpen(open === item.id ? '' : item.id)}>{open === item.id ? 'Hide status' : 'View status'}</button>
                      {item.status === 'failed' && item.retry_count < 3 && <button className="text-button" type="button" onClick={() => retry(item.id)}>Retry</button>}
                    </div></td>
                  </tr>
                  {open === item.id && <tr><td colSpan={7}><History id={item.id} /></td></tr>}
                </Fragment>
              ))}
            </tbody>
          </table>
          {!emails.length && <p>No emails match.</p>}
        </div>
        <nav className="admin-pagination" aria-label="Email pages">
          <button className="member-button secondary" type="button" disabled={state.data.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: state.data.page - 1 }))}>Previous</button>
          <span>Page {state.data.page} of {state.data.pages}</span>
          <button className="member-button secondary" type="button" disabled={state.data.page >= state.data.pages} onClick={() => setFilters((current) => ({ ...current, page: state.data.page + 1 }))}>Next</button>
        </nav>
      </section>
    </div>
  );
}
