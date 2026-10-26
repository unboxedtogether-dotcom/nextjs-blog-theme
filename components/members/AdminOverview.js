import { useCallback, useEffect, useState } from 'react';
import BrandLoader from '../BrandLoader';
import { readJson } from './AdminUi';

// Main team overview. Every figure comes from live database records; each
// card opens the matching filtered list.
export default function AdminOverview({ onNavigate }) {
  const [state, setState] = useState({ loading: true, error: '', data: null });
  const load = useCallback(() => {
    fetch('/api/admin/members?pageSize=5')
      .then((response) => readJson(response, 'The overview could not be loaded.'))
      .then((data) => setState({ loading: false, error: '', data }))
      .catch((error) => setState({ loading: false, error: error.message, data: null }));
  }, []);
  useEffect(() => { load(); }, [load]);
  const refresh = () => {
    setState((current) => ({ ...current, loading: true }));
    load();
  };

  if (state.loading && !state.data) return <BrandLoader label="Loading the overview…" />;
  if (state.error) return <p className="onboarding-error" role="alert">{state.error}</p>;
  const { summary, communications: comms, identity } = state.data;
  const members = (filter) => () => onNavigate({ tab: 'members', filter });
  const emails = (filters) => () => onNavigate({ tab: 'emails', ...filters });
  const referrals = () => onNavigate({ tab: 'referrals' });

  const groups = [
    ['Members', [
      ['Total registered members', summary.members, members('all')],
      ['New this week', summary.newThisWeek, members('new_week')],
      ['New this month', summary.newThisMonth, members('new_month')],
      ['Email not yet verified', summary.unverified, members('unverified')],
      ['Awaiting onboarding', summary.awaitingOnboarding, members('awaiting_onboarding')],
      ['Completed onboarding', summary.onboarded, members('onboarded')],
      ['Active (last 30 days)', summary.active, members('active')],
      ['Overdue weekly check-in', summary.checkinOverdue, members('checkin_overdue')],
    ]],
    ['Questionnaires', [
      ['Welcome questionnaires completed', summary.welcomeCompleted, members('welcome_completed')],
      ['Welcome questionnaires outstanding', summary.welcomeOutstanding, members('welcome_outstanding')],
      ['Optional sections completed', summary.optionalCompleted, members('optional_completed')],
      ['Weekly check-ins completed (all time)', summary.checkinsCompleted, members('checkin_completed')],
      ['Checked in this week', summary.checkedInThisWeek, members('checkin_completed')],
      ['Weekly check-ins due', summary.checkinDue, members('checkin_due')],
      ['Overdue weekly check-ins', summary.checkinOverdue, members('checkin_overdue')],
      ['Missed 2 or more check-ins', summary.missedMultiple, members('missed_multiple')],
      ['Baseline not recorded yet', summary.baselineNeeded, members('baseline_needed')],
    ]],
    ['Referrals', [
      ['Referral invitations created', comms.referrals.created, referrals],
      ['Shared by members', comms.referrals.shared, referrals],
      ['Invitation emails accepted by provider', comms.referrals.emails_sent, emails({ kind: 'referrals', status: 'accepted' })],
      ['Invitation emails pending or failed', comms.referrals.emails_pending_or_failed, emails({ kind: 'referrals' })],
      ['Referral links opened', comms.referrals.opened, referrals],
      ['Referred people who registered', comms.referrals.registered, referrals],
      ['Referred members who completed onboarding', comms.referrals.onboarded, referrals],
      ['Members who have referred a friend', summary.withReferrals, members('has_referrals')],
    ]],
    ['Communications', [
      ['Emails awaiting dispatch', comms.emails.awaiting, emails({ status: 'pending' })],
      ['Accepted by the email provider', comms.emails.accepted, emails({ status: 'accepted' })],
      ['Delivery confirmed', comms.emails.delivered, emails({ status: 'delivered' })],
      ['Delivery failures and bounces', comms.emails.failures, emails({ status: 'failed' })],
      ['Reminders sent', comms.emails.reminders_sent, emails({ kind: 'reminders' })],
      ['Members who have not responded to a reminder', summary.noResponse, members('no_response')],
      ['Members asking for practical support (new)', comms.support.members, () => onNavigate({ tab: 'messages' })],
      ['Prospects asking for personal support (new)', comms.support.prospects, () => onNavigate({ tab: 'prospects' })],
    ]],
  ];

  return (
    <div className="admin-progress">
      <section className="profile-panel">
        <div className="admin-panel-head">
          <h2>Overview</h2>
          <button className="member-button secondary" type="button" onClick={refresh} disabled={state.loading}>{state.loading ? 'Refreshing…' : 'Refresh'}</button>
        </div>
        <p>Live figures from member records. Select any card to see the members or emails behind it. Prospective members who only completed the public interest form are not counted as members.</p>
        {!comms.emails.deliveryConfigured && <p className="admin-consent">Email delivery is not configured, so emails are held in the queue and not sent. Add the email provider settings to switch sending on.</p>}
        {comms.emails.deliveryConfigured && !comms.emails.webhookConfigured && <p className="dashboard-note">Delivery confirmations and bounces are not being received yet (no webhook signing secret), so emails show as “accepted by provider” at most.</p>}
        {identity && !identity.available && <p className="dashboard-note">Netlify Identity could not be reached just now, so accounts that have never signed in may be missing from these figures.</p>}
        {identity?.reconciled > 0 && <p className="dashboard-note" role="status">{identity.reconciled} registered {identity.reconciled === 1 ? 'account was' : 'accounts were'} added to the member list from Netlify Identity.</p>}
      </section>
      {groups.map(([title, cards]) => (
        <section className="profile-panel" key={title} aria-labelledby={`overview-${title}`}>
          <h2 id={`overview-${title}`}>{title}</h2>
          <ul className="admin-tiles is-interactive">
            {cards.map(([label, value, open]) => (
              <li key={label}><button type="button" onClick={open}><strong>{value ?? '—'}</strong><span>{label}</span></button></li>
            ))}
          </ul>
          {title === 'Referrals' && comms.referrals.topReferrers.length > 0 && (
            <>
              <h3>Most active referrers</h3>
              <ol className="admin-history">{comms.referrals.topReferrers.map((item) => (
                <li key={item.id}><button className="text-button inline" type="button" onClick={() => onNavigate({ tab: 'members', member: item.id })}>{item.display_name || 'Member'}</button> — {item.referrals} {item.referrals === 1 ? 'invitation' : 'invitations'}, {item.registered} registered</li>
              ))}</ol>
            </>
          )}
        </section>
      ))}
    </div>
  );
}
