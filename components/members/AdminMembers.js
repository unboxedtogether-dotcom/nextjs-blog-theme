import { useCallback, useEffect, useState } from 'react';
import BrandLoader from '../BrandLoader';
import { checkinStatusLabels, emailStatusLabels, emailStatusTone, reminderTemplates } from '../../utils/member-status.mjs';
import { ReminderDialog, StatusPill, formatDate, formatDay, readJson } from './AdminUi';

export const memberFilterOptions = [
  ['all', 'All members'],
  ['new_week', 'Joined in the last 7 days'],
  ['new_month', 'Joined in the last 30 days'],
  ['unverified', 'Email not verified'],
  ['awaiting_onboarding', 'Awaiting onboarding'],
  ['onboarded', 'Completed onboarding'],
  ['active', 'Active (last 30 days)'],
  ['checking_in', 'Checking in regularly'],
  ['welcome_completed', 'Welcome form completed'],
  ['welcome_outstanding', 'Welcome form outstanding'],
  ['welcome_in_progress', 'Welcome form in progress'],
  ['optional_completed', 'Optional sections saved'],
  ['baseline_needed', 'Baseline not recorded'],
  ['checkin_completed', 'Checked in this week'],
  ['checkin_due', 'Check-in due'],
  ['checkin_overdue', 'Check-in overdue'],
  ['missed_multiple', 'Missed 2+ check-ins'],
  ['no_response', 'Not responded to a reminder'],
  ['has_referrals', 'Has referred friends'],
  ['email_problem', 'Email failed or bounced'],
  ['reminders_paused', 'Reminder emails turned off'],
  ['can_remind_welcome', 'Can receive welcome reminder'],
  ['can_remind_checkin', 'Can receive check-in reminder'],
  ['can_remind_baseline', 'Can receive onboarding reminder'],
];
const sortOptions = [['joined_desc', 'Newest first'], ['joined_asc', 'Oldest first'], ['activity_desc', 'Recent activity'], ['last_checkin_desc', 'Latest check-in'], ['next_due_asc', 'Next due date'], ['name_asc', 'Name A–Z']];
const welcomeLabels = { completed: 'Completed', in_progress: 'In progress', not_started: 'Not started' };
const kindLabels = { welcome_reminder: 'Welcome reminder', checkin_reminder: 'Check-in reminder', baseline_reminder: 'Onboarding reminder', member_welcome: 'Welcome email' };

export function WelcomeCell({ member }) {
  return (
    <>
      <StatusPill status={member.welcome_status}>{welcomeLabels[member.welcome_status]}</StatusPill>
      {member.welcome_completed_at && <small>{formatDate(member.welcome_completed_at)}</small>}
      {member.reminders?.welcome && member.welcome_status !== 'completed' && <small>Reminder {formatDate(member.reminders.welcome.at)}</small>}
    </>
  );
}

export function CheckinCell({ member }) {
  return (
    <>
      <StatusPill status={member.checkin_status}>{checkinStatusLabels[member.checkin_status]}</StatusPill>
      <small>{member.last_checkin_date ? `Last ${formatDay(member.last_checkin_date)}` : 'No check-ins yet'} · {member.checkins} done</small>
      {member.missed > 0 && <small>{member.missed} missed</small>}
    </>
  );
}

export function EmailCell({ member }) {
  if (member.email_suppressed) return <StatusPill tone="red">Suppressed</StatusPill>;
  if (!member.last_email) return <StatusPill tone="grey">None</StatusPill>;
  return <><StatusPill tone={emailStatusTone[member.last_email.status]}>{emailStatusLabels[member.last_email.status]}</StatusPill><small>{kindLabels[member.last_email.kind] || 'Email'} · {formatDate(member.last_email.at)}</small></>;
}

// Interactive member table. Search, filters, sorting and paging all happen
// on the server, so no member data is sent to the browser just to be hidden.
export default function AdminMembers({ initialFilter = 'all', onOpenMember }) {
  const [params, setParams] = useState({ q: '', filter: initialFilter, sort: 'joined_desc', page: 1, pageSize: 25 });
  const [term, setTerm] = useState('');
  const [state, setState] = useState({ loading: true, error: '', data: null });
  const [selected, setSelected] = useState(() => new Set());
  const [dialog, setDialog] = useState(null);

  const load = useCallback(() => {
    const query = new URLSearchParams({ ...params, view: 'list', page: String(params.page), pageSize: String(params.pageSize) });
    fetch(`/api/admin/members?${query}`)
      .then((response) => readJson(response, 'Members could not be loaded.'))
      .then((data) => setState({ loading: false, error: '', data }))
      .catch((error) => setState({ loading: false, error: error.message, data: null }));
  }, [params]);
  useEffect(() => { load(); }, [load]);
  const refresh = () => {
    setState((current) => ({ ...current, loading: true }));
    load();
  };

  const set = (key) => (event) => setParams((current) => ({ ...current, [key]: event.target.value, page: 1 }));
  const toggle = (id) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const pageIds = state.data?.members.map((member) => member.id) || [];
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const togglePage = () => setSelected((current) => {
    const next = new Set(current);
    for (const id of pageIds) { if (allOnPage) next.delete(id); else next.add(id); }
    return next;
  });
  const openDialog = (type, ids) => setDialog({ type, members: [...ids] });

  return (
    <div className="admin-progress">
      <section className="profile-panel">
        <div className="admin-panel-head">
          <h2>Members{state.data ? <small> {state.data.total} {state.data.total === 1 ? 'match' : 'matches'} of {state.data.summary.members}</small> : null}</h2>
          <button className="member-button secondary" type="button" onClick={refresh} disabled={state.loading}>{state.loading ? 'Refreshing…' : 'Refresh'}</button>
        </div>
        <form className="admin-search" role="search" onSubmit={(event) => { event.preventDefault(); setParams((current) => ({ ...current, q: term.trim(), page: 1 })); }}>
          <label className="sr-only" htmlFor="members-search">Search by name or email</label>
          <input id="members-search" className="wq-input" type="search" value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Search by name or email" />
          <button className="member-button" type="submit">Search</button>
        </form>
        <div className="admin-search">
          <label className="sr-only" htmlFor="members-filter">Status</label>
          <select id="members-filter" className="wq-input" value={params.filter} onChange={set('filter')}>
            {memberFilterOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <label className="sr-only" htmlFor="members-sort">Sort</label>
          <select id="members-sort" className="wq-input" value={params.sort} onChange={set('sort')}>
            {sortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>

        <div className="admin-bulk-bar" aria-live="polite">
          <strong>{selected.size} selected</strong>
          {Object.entries(reminderTemplates).map(([type, template]) => (
            <button key={type} className="member-button secondary" type="button" disabled={!selected.size} onClick={() => openDialog(type, selected)}>{template.label}…</button>
          ))}
          {selected.size > 0 && <button className="text-button inline" type="button" onClick={() => setSelected(new Set())}>Clear selection</button>}
        </div>

        {state.error && <p className="onboarding-error" role="alert">{state.error}</p>}
        {state.loading && !state.data ? <BrandLoader label="Loading members…" /> : state.data && (
          <>
            <div className="admin-table-wrap">
              <table className="admin-table admin-members-table">
                <thead><tr>
                  <th><input type="checkbox" aria-label="Select every member on this page" checked={allOnPage} onChange={togglePage} /></th>
                  <th>Member</th><th>Joined</th><th>Welcome form</th><th>Weekly check-in</th><th>Next due</th><th>Referrals</th><th>Email status</th><th><span className="sr-only">Actions</span></th>
                </tr></thead>
                <tbody>
                  {state.data.members.map((member) => (
                    <tr key={member.id} className={selected.has(member.id) ? 'is-selected' : ''}>
                      <td><input type="checkbox" aria-label={`Select ${member.display_name || 'member'}`} checked={selected.has(member.id)} onChange={() => toggle(member.id)} /></td>
                      <td className="admin-table__member">
                        <button className="text-button inline" type="button" onClick={() => onOpenMember(member.id)}>{member.display_name || 'Member'}</button>
                        <small>{member.email || 'No email on record'}</small>
                        {!member.email_verified && <StatusPill tone="grey">Not verified</StatusPill>}
                        {member.identity_missing && <StatusPill tone="red">No Identity account</StatusPill>}
                      </td>
                      <td>{formatDate(member.signed_up_at)}</td>
                      <td><WelcomeCell member={member} /></td>
                      <td><CheckinCell member={member} /></td>
                      <td>{member.next_due ? formatDay(member.next_due) : '—'}</td>
                      <td>{member.referrals}{member.referrals_registered > 0 && <small>{member.referrals_registered} registered</small>}</td>
                      <td><EmailCell member={member} /></td>
                      <td><div className="admin-table__actions">
                        <button className="text-button" type="button" onClick={() => onOpenMember(member.id)}>View member</button>
                        {member.can_remind.welcome && <button className="text-button" type="button" onClick={() => openDialog('welcome', [member.id])}>Send welcome reminder</button>}
                        {member.can_remind.checkin && <button className="text-button" type="button" onClick={() => openDialog('checkin', [member.id])}>Send check-in reminder</button>}
                        {member.can_remind.baseline && <button className="text-button" type="button" onClick={() => openDialog('baseline', [member.id])}>Send onboarding reminder</button>}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!state.data.members.length && <p>No members match.</p>}
            </div>
            <nav className="admin-pagination" aria-label="Member pages">
              <button className="member-button secondary" type="button" disabled={state.data.page <= 1 || state.loading} onClick={() => setParams((current) => ({ ...current, page: state.data.page - 1 }))}>Previous</button>
              <span>Page {state.data.page} of {state.data.pages}</span>
              <button className="member-button secondary" type="button" disabled={state.data.page >= state.data.pages || state.loading} onClick={() => setParams((current) => ({ ...current, page: state.data.page + 1 }))}>Next</button>
              <label>Per page <select className="wq-input" value={params.pageSize} onChange={set('pageSize')}>{[25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
            </nav>
          </>
        )}
      </section>
      {dialog && <ReminderDialog type={dialog.type} members={dialog.members} onClose={() => setDialog(null)} onSent={refresh} />}
    </div>
  );
}
