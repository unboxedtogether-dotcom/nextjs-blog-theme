import { useCallback, useEffect, useState } from 'react';
import BrandLoader from '../BrandLoader';
import MemberDetail from './AdminQuestionnaireDetail';
import { MemberProgress } from './AdminProgress';
import SubmissionVersions, { submissionStatus } from './SubmissionView';
import { CheckinCell, EmailCell, WelcomeCell } from './AdminMembers';
import { ReminderDialog, StatusPill, formatDate, formatDateTime, formatDay, readJson } from './AdminUi';
import { submissionTitle } from '../../utils/progress-checkin.mjs';
import { weekLabel } from '../../utils/progress-timeline.mjs';
import {
  emailStatusLabels, emailStatusTone, referralStage, referralStageLabels, referralStageTone, reminderTemplates,
} from '../../utils/member-status.mjs';

const kindLabels = { welcome_reminder: 'Welcome form reminder', checkin_reminder: 'Weekly check-in reminder', baseline_reminder: 'Onboarding reminder', member_welcome: 'Welcome email' };
const consentLabel = (entry) => (entry ? `${entry.action === 'given' ? 'Given' : 'Withdrawn'} ${formatDate(entry.at)}` : 'Not given');
const weekTone = { complete: 'green', incomplete: 'amber', missed: 'red', due: 'amber' };
const weekText = { complete: 'Completed', incomplete: 'Incomplete (not scored)', missed: 'Missed', due: 'Due' };
const signed = (value) => (value === null || value === undefined ? '—' : `${value > 0 ? '+' : ''}${Math.round(value)}`);

function EmailHistory({ id }) {
  const [state, setState] = useState({ loading: true, error: '', events: [] });
  useEffect(() => {
    fetch(`/api/admin/emails?email=${encodeURIComponent(id)}`)
      .then((response) => readJson(response, 'The history could not be loaded.'))
      .then((data) => setState({ loading: false, error: '', events: data.events }))
      .catch((error) => setState({ loading: false, error: error.message, events: [] }));
  }, [id]);
  if (state.loading) return <small>Loading…</small>;
  if (state.error) return <small className="onboarding-error">{state.error}</small>;
  return <ul className="admin-history">{state.events.map((event, index) => <li key={index}>{formatDateTime(event.occurred_at)} — {event.event_type}{event.detail ? ` · ${event.detail}` : ''}</li>)}</ul>;
}

// One member's full admin record. Questionnaire answers are not part of
// this page: "View form" opens them through the separate, logged views.
export default function AdminMemberRecord({ id, onClose }) {
  const [state, setState] = useState({ loading: true, error: '', data: null });
  const [view, setView] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [openEmail, setOpenEmail] = useState('');

  const load = useCallback(() => {
    fetch(`/api/admin/members?member=${encodeURIComponent(id)}`)
      .then((response) => readJson(response, 'This member could not be loaded.'))
      .then((data) => setState({ loading: false, error: '', data }))
      .catch((error) => setState({ loading: false, error: error.message, data: null }));
  }, [id]);
  useEffect(load, [load]);

  const openSubmission = async (submissionId) => {
    setView({ type: 'submission', loading: true });
    try {
      const detail = await readJson(await fetch(`/api/admin/progress?member=${encodeURIComponent(id)}&submission=${encodeURIComponent(submissionId)}`), 'That form could not be loaded.');
      setView({ type: 'submission', detail });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setView({ type: 'error', error: error.message });
    }
  };

  if (view?.type === 'welcome') return <MemberDetail id={id} onClose={() => setView(null)} />;
  if (view?.type === 'progress') return <MemberProgress id={id} onClose={() => setView(null)} />;
  if (view?.type === 'submission' && view.detail) return <SubmissionVersions detail={view.detail} onClose={() => setView(null)} />;
  if (state.loading) return <BrandLoader label="Loading member record…" />;
  if (state.error) return <div className="admin-progress"><section className="profile-panel"><button className="text-button" type="button" onClick={onClose}>← Back to members</button><p className="onboarding-error" role="alert">{state.error}</p></section></div>;

  const { member, submissions, consent, optionalSections, emails, referrals, referredBy, progress, timeline, emailDelivery } = state.data;
  const roots = submissions.filter((row) => row.revision_number === 0);
  const versions = (row) => submissions.filter((item) => item.root_id === row.id).length;
  const forms = [
    { key: 'welcome_details', name: 'Welcome questionnaire (required)', requested: member.signed_up_at, status: member.welcome_status, root: roots.find((row) => row.form_type === 'welcome_details') },
    ...[['welcome_food', 'Optional: food and drink', 2], ['welcome_everyday', 'Optional: everyday life', 3], ['welcome_health', 'Optional: health and wellbeing', 4]].map(([key, name, page]) => ({
      key, name, optional: true, root: roots.find((row) => row.form_type === key),
      status: !optionalSections ? 'not_applicable' : optionalSections[page] ? 'completed' : 'not_started',
    })),
    { key: 'baseline_wellbeing', name: 'Progress baseline', status: progress.baseline ? 'completed' : progress.consent.given ? 'baseline_needed' : 'not_applicable', root: roots.find((row) => row.form_type === 'baseline_wellbeing') },
  ];
  const statusText = { completed: 'Completed', in_progress: 'In progress', not_started: 'Not started', not_applicable: 'Not applicable', baseline_needed: 'Not recorded yet' };

  return (
    <div className="admin-progress">
      <section className="profile-panel">
        <button className="text-button" type="button" onClick={onClose}>← Back to members</button>
        <div className="admin-panel-head">
          <h2>{member.display_name || 'Member'}</h2>
          <button className="member-button secondary" type="button" onClick={load}>Refresh</button>
        </div>
        <h3>Member profile</h3>
        <dl className="submission-meta">
          <div><dt>Email</dt><dd>{member.email || '—'}</dd></div>
          <div><dt>Registered</dt><dd>{formatDate(member.signed_up_at)}</dd></div>
          <div><dt>Account</dt><dd>{member.email_verified ? <StatusPill tone="green">Email verified{member.email_verified_at ? ` ${formatDate(member.email_verified_at)}` : ''}</StatusPill> : <StatusPill tone="grey">Email not verified</StatusPill>} {member.identity_missing && <StatusPill tone="red">No Identity account</StatusPill>}</dd></div>
          <div><dt>Membership</dt><dd>{member.membership_status}</dd></div>
          <div><dt>Welcome questionnaire</dt><dd><WelcomeCell member={member} /></dd></div>
          <div><dt>Weekly check-in</dt><dd><CheckinCell member={member} /></dd></div>
          <div><dt>Marketing emails</dt><dd>{member.marketing_consent ? 'Opted in' : 'Not opted in'}</dd></div>
          <div><dt>Reminder emails</dt><dd>{member.reminders_paused ? <StatusPill tone="grey">Turned off by member</StatusPill> : 'On'}{member.email_suppressed && <> <StatusPill tone="red">Address suppressed</StatusPill></>}</dd></div>
          <div><dt>Progress tracking consent</dt><dd>{consentLabel(consent.progress_tracking)}</dd></div>
          <div><dt>Health information consent</dt><dd>{consentLabel(consent.health_information)}</dd></div>
          <div><dt>Last activity</dt><dd>{formatDate(member.last_activity_at)}{member.active ? ' · active' : ''}</dd></div>
          <div><dt>Last email</dt><dd><EmailCell member={member} /></dd></div>
          {referredBy && <div><dt>Referred by</dt><dd>{referredBy.referrer_name || 'A member'} ({referredBy.attributed_by === 'token' ? 'invitation link' : 'matching email'})</dd></div>}
        </dl>
        <div className="card-actions">
          {Object.entries(reminderTemplates).map(([type, template]) => (
            <button key={type} className="member-button secondary" type="button" disabled={!member.can_remind[type]} title={member.remind_reasons[type] || ''} onClick={() => setDialog({ type, members: [id] })}>
              {member.reminders[type] ? 'Resend' : 'Send'} {template.label.toLowerCase()}
            </button>
          ))}
        </div>
        <ul className="admin-history">
          {Object.entries(reminderTemplates).filter(([type]) => !member.can_remind[type]).map(([type, template]) => <li key={type}><small>{template.label}: {member.remind_reasons[type]}</small></li>)}
        </ul>
        {!emailDelivery && <p className="dashboard-note">Email delivery is not configured, so reminders are queued and not sent.</p>}
        {view?.type === 'error' && <p className="onboarding-error" role="alert">{view.error}</p>}
      </section>

      <section className="profile-panel">
        <h2>Forms &amp; questionnaires</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Form</th><th>Requested</th><th>Due</th><th>Completed</th><th>Status</th><th>Versions</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {forms.map((form) => (
                <tr key={form.key}>
                  <td>{form.name}</td>
                  <td>{form.requested ? formatDate(form.requested) : '—'}</td>
                  <td>{form.optional ? 'Optional' : '—'}</td>
                  <td>{form.root ? formatDate(form.root.submitted_at) : '—'}</td>
                  <td><StatusPill status={form.status}>{statusText[form.status]}</StatusPill></td>
                  <td>{form.root ? versions(form.root) : 0}</td>
                  <td><div className="admin-table__actions">
                    {form.root && form.key.startsWith('welcome_') && <button className="text-button" type="button" onClick={() => setView({ type: 'welcome' })}>View form</button>}
                    {form.root && <button className="text-button" type="button" onClick={() => openSubmission(form.root.id)}>View submissions</button>}
                  </div></td>
                </tr>
              ))}
              <tr>
                <td>Weekly check-ins</td>
                <td>{progress.baseline ? `Weekly from ${formatDay(progress.baseline.weekStart)}` : '—'}</td>
                <td>{member.next_due ? formatDay(member.next_due) : '—'}</td>
                <td>{member.last_checkin_date ? formatDay(member.last_checkin_date) : '—'}</td>
                <td><CheckinCell member={member} /></td>
                <td>{member.checkins}</td>
                <td><button className="text-button" type="button" onClick={() => setView({ type: 'progress' })}>View progress</button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="settings-note">Only the first welcome page is required. Optional sections are never marked overdue. Health answers are only held where the member gave explicit consent, and every form view is recorded.</p>
      </section>

      <section className="profile-panel">
        <h2>Weekly progress</h2>
        {progress.baseline ? (
          <>
            <dl className="submission-meta">
              <div><dt>Baseline date</dt><dd>{formatDay(progress.baseline.date)}</dd></div>
              <div><dt>Most recent check-in</dt><dd>{member.last_checkin_date ? formatDay(member.last_checkin_date) : 'None yet'}</dd></div>
              <div><dt>Current score</dt><dd>{progress.summary.currentScore === null ? '—' : `${Math.round(progress.summary.currentScore)}/100`}</dd></div>
              <div><dt>Previous score</dt><dd>{progress.summary.previousScore === null ? '—' : `${Math.round(progress.summary.previousScore)}/100`}</dd></div>
              <div><dt>Score change</dt><dd>{signed(progress.summary.change)}</dd></div>
              <div><dt>Next check-in due</dt><dd>{member.next_due ? formatDay(member.next_due) : '—'}</dd></div>
            </dl>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Week</th><th>Dated</th><th>Status</th><th>Score</th><th>Change</th><th>Scoring version</th></tr></thead>
                <tbody>{[...progress.weeks].reverse().map((week) => (
                  <tr key={week.weekNumber}>
                    <td>{weekLabel(week.weekNumber)}</td>
                    <td>{week.entryDate ? formatDay(week.entryDate) : '—'}</td>
                    <td><StatusPill tone={weekTone[week.status]}>{weekText[week.status] || week.status}</StatusPill></td>
                    <td>{week.overall === null ? '—' : `${Math.round(week.overall)}/100`}</td>
                    <td>{signed(week.change)}</td>
                    <td>{week.scoringVersion || '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <p className="settings-note">Scores are shown exactly as calculated under their stored scoring version ({progress.scoringVersion}); nothing is recalculated.</p>
          </>
        ) : <p>{progress.consent.given ? 'Progress tracking is on, but the baseline has not been recorded yet.' : 'This member has not turned on progress tracking.'}</p>}
      </section>

      <section className="profile-panel">
        <h2>Referrals</h2>
        {referrals.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Invited</th><th>Friend</th><th>Status</th><th>Email</th><th>Registered</th></tr></thead>
              <tbody>{referrals.map((item) => {
                const stage = referralStage({ ...item, onboarded_at: item.registered_onboarded ? item.registered_at : null });
                return (
                  <tr key={item.id}>
                    <td>{formatDate(item.created_at)}</td>
                    <td>{item.recipient_name || '—'}<small>{item.recipient_email || 'No address given'}</small></td>
                    <td><StatusPill tone={referralStageTone[stage]}>{referralStageLabels[stage]}</StatusPill></td>
                    <td>{item.email_status ? <StatusPill tone={emailStatusTone[item.email_status]}>{emailStatusLabels[item.email_status]}</StatusPill> : <small>Not emailed by us</small>}</td>
                    <td>{item.registered_at ? <>{formatDate(item.registered_at)}<small>{item.registered_name}</small></> : '—'}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        ) : <p>This member has not referred anyone yet.</p>}
      </section>

      <section className="profile-panel">
        <h2>Communication history</h2>
        {emails.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Email</th><th>Requested</th><th>Status</th><th>Detail</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>{emails.map((item) => (
                <tr key={item.id}>
                  <td>{kindLabels[item.kind] || item.kind}<small>Template {item.template_version}</small></td>
                  <td>{formatDateTime(item.created_at)}</td>
                  <td><StatusPill tone={emailStatusTone[item.status]}>{emailStatusLabels[item.status]}</StatusPill></td>
                  <td>{item.last_error || (item.sent_at ? `Accepted ${formatDateTime(item.sent_at)}` : '—')}{openEmail === item.id && <EmailHistory id={item.id} />}</td>
                  <td><button className="text-button" type="button" onClick={() => setOpenEmail(openEmail === item.id ? '' : item.id)}>{openEmail === item.id ? 'Hide history' : 'View history'}</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p>No emails have been sent to this member.</p>}
        <h3>Activity timeline</h3>
        {timeline.length ? (
          <ol className="admin-timeline">{timeline.map((event, index) => (
            <li key={`${event.at}-${index}`} className={`is-${event.type}`}><time dateTime={event.at}>{formatDateTime(event.at)}</time> {event.label}</li>
          ))}</ol>
        ) : <p>No activity recorded yet.</p>}
        <p className="settings-note">The timeline never shows questionnaire answers.</p>
      </section>

      {dialog && <ReminderDialog type={dialog.type} members={dialog.members} onClose={() => setDialog(null)} onSent={load} />}
    </div>
  );
}
