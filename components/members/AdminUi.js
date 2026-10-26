import { useEffect, useRef, useState } from 'react';
import { reminderTemplates, statusTone } from '../../utils/member-status.mjs';

export const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const formatDateTime = (value) => (value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
export const formatDay = (value) => (value ? new Date(`${value}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—');
export const readJson = async (response, fallback) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || fallback);
  return data;
};
export const postJson = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// Green done, amber due soon, red overdue, grey not applicable, blue in transit.
export function StatusPill({ tone, status, children }) {
  return <span className={`status-pill is-${tone || statusTone[status] || 'grey'}`}>{children}</span>;
}

const outcomeLabels = { sent: 'Accepted by provider', queued: 'Queued', failed: 'Failed', cancelled: 'Cancelled', excluded: 'Not sent' };

/**
 * Two-step reminder sending: the server first says who would receive the
 * email and who is excluded (and why), the admin confirms, then the server
 * checks everything again and reports each result.
 */
export function ReminderDialog({ type, members, onClose, onSent }) {
  const [state, setState] = useState({ step: 'loading', preview: null, result: null, error: '' });
  const dialog = useRef(null);
  const template = reminderTemplates[type];

  useEffect(() => {
    dialog.current?.focus();
    postJson('/api/admin/members', { action: 'preview_reminders', type, members })
      .then((response) => readJson(response, 'The reminder could not be prepared.'))
      .then((preview) => setState({ step: 'confirm', preview, result: null, error: '' }))
      .catch((error) => setState({ step: 'error', preview: null, result: null, error: error.message }));
  }, [type, members]);

  const send = async () => {
    setState((current) => ({ ...current, step: 'sending' }));
    try {
      const result = await readJson(await postJson('/api/admin/members', { action: 'send_reminders', type, members, confirm: true }), 'The reminders could not be sent.');
      setState((current) => ({ ...current, step: 'done', result }));
      onSent?.(result);
    } catch (error) {
      setState((current) => ({ ...current, step: 'confirm', error: error.message }));
    }
  };

  const { preview, result } = state;
  return (
    <div className="admin-dialog" role="presentation" onClick={(event) => { if (event.target === event.currentTarget && state.step !== 'sending') onClose(); }}>
      <div className="admin-dialog__panel" role="dialog" aria-modal="true" aria-labelledby="reminder-dialog-title" tabIndex={-1} ref={dialog}
        onKeyDown={(event) => { if (event.key === 'Escape' && state.step !== 'sending') onClose(); }}>
        <h2 id="reminder-dialog-title">{template.label}</h2>
        {state.step === 'loading' && <p role="status">Checking who can receive this reminder…</p>}
        {state.step === 'error' && <p className="onboarding-error" role="alert">{state.error}</p>}
        {preview && state.step !== 'done' && (
          <>
            <dl className="submission-meta">
              <div><dt>Selected</dt><dd>{preview.selected}</dd></div>
              <div><dt>Will receive it</dt><dd><strong>{preview.eligible.length}</strong></dd></div>
              <div><dt>Excluded</dt><dd>{preview.excluded.length}</dd></div>
              <div><dt>Email template</dt><dd>“{preview.template.subject}”</dd></div>
            </dl>
            {preview.excluded.length > 0 && (
              <details className="admin-dialog__details">
                <summary>Why {preview.excluded.length} {preview.excluded.length === 1 ? 'member is' : 'members are'} excluded</summary>
                <ul>{Object.entries(preview.excludedReasons).map(([reason, total]) => <li key={reason}>{reason}: {total}</li>)}</ul>
                <ul className="admin-dialog__names">{preview.excluded.map((item) => <li key={item.id}>{item.name} — {item.reason}</li>)}</ul>
              </details>
            )}
            {!preview.deliveryConfigured && <p className="dashboard-note">Email delivery is not configured yet, so reminders are queued and only sent once it is. Queued reminders expire after 7 days rather than being sent late.</p>}
            <p className="settings-note">Reminders contain no answers or scores. Each member gets at most one check-in reminder per week and at most 3 welcome or onboarding reminders, {preview.gapDays} days apart.</p>
            {state.error && <p className="onboarding-error" role="alert">{state.error}</p>}
          </>
        )}
        {state.step === 'done' && result && (
          <>
            <p role="status"><strong>{result.emailDelivery ? `${result.sent} accepted by the email provider` : `${result.queued} queued`}</strong>{result.failed ? ` · ${result.failed} failed` : ''} · {result.skipped} not sent.</p>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Member</th><th>Result</th><th>Detail</th></tr></thead>
                <tbody>{result.results.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td><StatusPill tone={{ sent: 'blue', queued: 'amber', failed: 'red' }[item.outcome] || 'grey'}>{outcomeLabels[item.outcome] || item.outcome}</StatusPill></td>
                    <td>{item.reason || '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </>
        )}
        <div className="card-actions">
          {state.step === 'done' || state.step === 'error'
            ? <button className="member-button" type="button" onClick={onClose}>Close</button>
            : (
              <>
                <button className="member-button" type="button" disabled={state.step !== 'confirm' || !preview?.eligible.length} onClick={send}>
                  {state.step === 'sending' ? 'Sending…' : `Send to ${preview?.eligible.length ?? 0} ${preview?.eligible.length === 1 ? 'member' : 'members'}`}
                </button>
                <button className="member-button secondary" type="button" disabled={state.step === 'sending'} onClick={onClose}>Cancel</button>
              </>
            )}
        </div>
      </div>
    </div>
  );
}
