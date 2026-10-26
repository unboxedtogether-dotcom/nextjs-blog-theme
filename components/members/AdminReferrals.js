import { useCallback, useEffect, useState } from 'react';
import BrandLoader from '../BrandLoader';
import { emailStatusLabels, emailStatusTone, referralStage, referralStageLabels, referralStageTone } from '../../utils/member-status.mjs';
import { StatusPill, formatDate, readJson } from './AdminUi';

// Every referral with its furthest milestone. Recipient addresses are shown
// to admins only; invitation tokens are never sent to the browser.
export default function AdminReferrals({ onOpenMember }) {
  const [state, setState] = useState({ loading: true, error: '', data: null });
  const [stage, setStage] = useState('');
  const load = useCallback(() => {
    fetch('/api/admin/members?view=referrals')
      .then((response) => readJson(response, 'Referrals could not be loaded.'))
      .then((data) => setState({ loading: false, error: '', data }))
      .catch((error) => setState({ loading: false, error: error.message, data: null }));
  }, []);
  useEffect(() => { load(); }, [load]);
  const refresh = () => {
    setState((current) => ({ ...current, loading: true }));
    load();
  };

  if (state.loading && !state.data) return <BrandLoader label="Loading referrals…" />;
  if (state.error) return <p className="onboarding-error" role="alert">{state.error}</p>;
  const { referrals, communications } = state.data;
  const totals = communications.referrals;
  const rows = referrals.map((item) => ({ ...item, stage: referralStage({ ...item, onboarded_at: item.registered_onboarded ? item.registered_at : null }) }));
  const shown = stage ? rows.filter((item) => item.stage === stage) : rows;
  const tiles = [
    ['Invitations created', totals.created], ['Shared by members', totals.shared], ['Emails accepted by provider', totals.emails_sent],
    ['Emails pending or failed', totals.emails_pending_or_failed], ['Links opened', totals.opened], ['Registered interest', totals.interested],
    ['Registered as members', totals.registered], ['Completed onboarding', totals.onboarded],
  ];

  return (
    <div className="admin-progress">
      <section className="profile-panel">
        <div className="admin-panel-head">
          <h2>Referrals</h2>
          <button className="member-button secondary" type="button" onClick={refresh} disabled={state.loading}>{state.loading ? 'Refreshing…' : 'Refresh'}</button>
        </div>
        <p>Members share a personal invitation link themselves. Unboxed Together only emails a friend directly when that person had already given verified consent to our emails, so most invitations show “Created – awaiting member sharing” or “Shared by member”. Link opens are recorded without cookies.</p>
        <ul className="admin-tiles">{tiles.map(([label, value]) => <li key={label}><strong>{value}</strong><span>{label}</span></li>)}</ul>
        {totals.topReferrers.length > 0 && (
          <>
            <h3>Most active referrers</h3>
            <ol className="admin-history">{totals.topReferrers.map((item) => <li key={item.id}><button className="text-button inline" type="button" onClick={() => onOpenMember(item.id)}>{item.display_name || 'Member'}</button> — {item.referrals} invited, {item.registered} registered</li>)}</ol>
          </>
        )}
      </section>
      <section className="profile-panel">
        <h2>{shown.length} {shown.length === 1 ? 'referral' : 'referrals'}</h2>
        <div className="admin-search">
          <select className="wq-input" aria-label="Referral status" value={stage} onChange={(event) => setStage(event.target.value)}>
            <option value="">Any status</option>
            {Object.entries(referralStageLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Referred by</th><th>Friend</th><th>Invited</th><th>Status</th><th>Email</th><th>Opened</th><th>Registered</th></tr></thead>
            <tbody>{shown.map((item) => (
              <tr key={item.id}>
                <td><button className="text-button inline" type="button" onClick={() => onOpenMember(item.referrer_user_id)}>{item.referrer_name || 'Member'}</button>{item.source === 'legacy_email' && <small>From the earlier email form</small>}</td>
                <td>{item.recipient_name || '—'}<small>{item.recipient_email || 'Link only'}</small></td>
                <td>{formatDate(item.created_at)}</td>
                <td><StatusPill tone={referralStageTone[item.stage]}>{referralStageLabels[item.stage]}</StatusPill></td>
                <td>{item.email_status ? <StatusPill tone={emailStatusTone[item.email_status]}>{emailStatusLabels[item.email_status]}</StatusPill> : <small>Not emailed by us</small>}{item.email_error && <small>{item.email_error}</small>}</td>
                <td>{item.first_opened_at ? <>{formatDate(item.first_opened_at)}<small>{item.open_count} {item.open_count === 1 ? 'visit' : 'visits'}</small></> : '—'}</td>
                <td>{item.registered_user_id ? <button className="text-button inline" type="button" onClick={() => onOpenMember(item.registered_user_id)}>{item.registered_name || 'Member'}</button> : '—'}{item.registered_at && <small>{formatDate(item.registered_at)}</small>}</td>
              </tr>
            ))}</tbody>
          </table>
          {!shown.length && <p>No referrals yet.</p>}
        </div>
      </section>
    </div>
  );
}
