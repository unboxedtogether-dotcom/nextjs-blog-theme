import { useEffect, useMemo, useState } from 'react';
import BrandLoader from '../BrandLoader';
import ProgressOverview, { formatDay } from '../progress/ProgressOverview';
import WelcomeStartingPoint from '../progress/WelcomeStartingPoint';
import { Change } from '../progress/ScoreChart';
import SubmissionVersions, { submissionStatus } from './SubmissionView';
import { scoreCategories, submissionTitle } from '../../utils/progress-checkin.mjs';
import { buildTimeline, weekLabel } from '../../utils/progress-timeline.mjs';

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const readJson = async (response, fallback) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || fallback);
  return data;
};

function CompareWeeks({ weeks }) {
  const scored = weeks.filter((week) => week.status === 'complete' || week.status === 'incomplete');
  const [from, setFrom] = useState(() => scored[0]?.weekNumber ?? null);
  const [to, setTo] = useState(() => scored[scored.length - 1]?.weekNumber ?? null);
  if (scored.length < 2) return <p className="dashboard-note">Two or more check-ins are needed to compare weeks.</p>;
  const a = scored.find((week) => week.weekNumber === Number(from));
  const b = scored.find((week) => week.weekNumber === Number(to));
  const row = (label, first, second) => {
    const delta = first !== null && first !== undefined && second !== null && second !== undefined ? Math.round(second) - Math.round(first) : null;
    return <tr key={label}><th scope="row">{label}</th><td>{first === null || first === undefined ? '—' : Math.round(first)}</td><td>{second === null || second === undefined ? '—' : Math.round(second)}</td><td>{delta === null ? 'Not comparable' : <Change delta={delta} comparedWeek={a.weekNumber} compact />}</td></tr>;
  };
  return (
    <div className="compare-weeks">
      <div className="compare-weeks__pick">
        <label>From <select className="wq-input" value={from} onChange={(event) => setFrom(event.target.value)}>{scored.map((week) => <option key={week.weekNumber} value={week.weekNumber}>{weekLabel(week.weekNumber)}</option>)}</select></label>
        <label>To <select className="wq-input" value={to} onChange={(event) => setTo(event.target.value)}>{scored.map((week) => <option key={week.weekNumber} value={week.weekNumber}>{weekLabel(week.weekNumber)}</option>)}</select></label>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Score</th><th>{weekLabel(a.weekNumber)}</th><th>{weekLabel(b.weekNumber)}</th><th>Change</th></tr></thead>
          <tbody>
            {row('Overall', a.status === 'complete' ? a.overall : null, b.status === 'complete' ? b.overall : null)}
            {scoreCategories.map((category) => row(category.fullLabel, a.categories?.[category.key]?.score, b.categories?.[category.key]?.score))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PrivateNoteForm({ onSave }) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState({ saving: false, error: '' });
  return (
    <form className="note-form" onSubmit={async (event) => {
      event.preventDefault();
      setStatus({ saving: true, error: '' });
      try { await onSave(text); setText(''); setStatus({ saving: false, error: '' }); } catch (error) { setStatus({ saving: false, error: error.message }); }
    }}>
      <textarea className="wq-input wq-textarea" value={text} maxLength={2000} onChange={(event) => setText(event.target.value)} aria-label="Private progress note" placeholder="Private note (only visible to the team)" />
      {status.error && <p className="onboarding-error" role="alert">{status.error}</p>}
      <button className="member-button secondary" type="submit" disabled={status.saving || !text.trim()}>{status.saving ? 'Saving…' : 'Add private note'}</button>
    </form>
  );
}

function MemberProgress({ id, onClose }) {
  const [state, setState] = useState({ loading: true, error: '', member: null });
  const [submission, setSubmission] = useState(null);
  useEffect(() => {
    fetch(`/api/admin/progress?member=${encodeURIComponent(id)}`)
      .then((response) => readJson(response, 'This member could not be loaded.'))
      .then((data) => setState({ loading: false, error: '', member: data.member }))
      .catch((error) => setState({ loading: false, error: error.message, member: null }));
  }, [id]);
  const timeline = useMemo(() => (state.member ? buildTimeline(state.member.entries, state.member.currentWeek.number) : null), [state.member]);

  const addNote = async (submissionId, body) => {
    const data = await readJson(await fetch('/api/admin/progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'note', member: id, submissionId, body }) }), 'The note could not be saved.');
    setState((current) => ({ ...current, member: data.member }));
  };
  const openSubmission = async (submissionId) => {
    setSubmission({ loading: true });
    try {
      const detail = await readJson(await fetch(`/api/admin/progress?member=${encodeURIComponent(id)}&submission=${encodeURIComponent(submissionId)}`), 'That record could not be loaded.');
      setSubmission({ detail });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setSubmission({ error: error.message });
    }
  };

  if (state.loading) return <BrandLoader label="Loading progress…" />;
  if (state.error) return <p className="onboarding-error" role="alert">{state.error}</p>;
  const { profile, consent, baseline, submissions, generalNotes } = state.member;
  if (submission?.detail) return <SubmissionVersions detail={submission.detail} onClose={() => setSubmission(null)} />;

  const missed = timeline.weeks.filter((week) => week.status === 'missed').map((week) => week.weekNumber);
  const incomplete = timeline.weeks.filter((week) => week.status === 'incomplete').map((week) => week.weekNumber);

  return (
    <div className="admin-progress">
      <section className="profile-panel">
        <button className="text-button" type="button" onClick={onClose}>← Back to all members</button>
        <h2>{profile.display_name}</h2>
        <dl className="submission-meta">
          <div><dt>Email</dt><dd>{profile.email || '—'}</dd></div>
          <div><dt>Membership</dt><dd>{profile.membership_status} since {formatDate(profile.membership_started_at)}</dd></div>
          <div><dt>Progress tracking consent</dt><dd>{consent.given ? `Given ${formatDate(consent.givenAt)}` : 'Not given'}</dd></div>
          <div><dt>Baseline</dt><dd>{baseline ? formatDay(baseline.date) : 'Not completed'}</dd></div>
          <div><dt>Welcome questionnaire baseline date</dt><dd>{state.member.welcomeStartingPoint?.date ? formatDay(state.member.welcomeStartingPoint.date) : '—'}</dd></div>
          <div><dt>Missed weeks</dt><dd>{missed.length ? missed.map(weekLabel).join(', ') : 'None'}</dd></div>
          <div><dt>Incomplete check-ins</dt><dd>{incomplete.length ? incomplete.map(weekLabel).join(', ') : 'None'}</dd></div>
        </dl>
        <div className="card-actions">
          <a className="member-button" href={`/api/admin/progress?member=${encodeURIComponent(id)}&export=pdf`}>Download progress report (PDF)</a>
        </div>
        {submission?.error && <p className="onboarding-error" role="alert">{submission.error}</p>}
      </section>

      {timeline.weeks.length > 0 && (
        <>
          <ProgressOverview entries={state.member.entries} currentWeekNumber={state.member.currentWeek.number} mode="admin" onAddNote={addNote} onOpenSubmission={openSubmission} />
          <section className="profile-panel">
            <h2>Compare two weeks</h2>
            <CompareWeeks weeks={timeline.weeks} />
          </section>
        </>
      )}

      {!timeline.weeks.length && <section className="profile-panel"><h2>No progress check-ins yet</h2><p>This member has not completed the baseline assessment, so there are no weekly scores. Their welcome questionnaire starting point is shown below when they have filled it in.</p></section>}
      <WelcomeStartingPoint point={state.member.welcomeStartingPoint} mode="admin" />

      <section className="profile-panel">
        <h2>General private notes</h2>
        {generalNotes.filter((note) => note.authorRole === 'admin').map((note) => <p key={note.id} className="note-item is-private">{note.body} <small>{formatDate(note.createdAt)}</small></p>)}
        <PrivateNoteForm onSave={(text) => addNote(null, text)} />
      </section>

      <section className="profile-panel">
        <h2>Every submitted form</h2>
        {submissions.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Form</th><th>Dated</th><th>Submitted</th><th>Status</th><th>Score</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {submissions.map((row) => (
                  <tr key={row.id}>
                    <td>{submissionTitle(row)}</td><td>{row.entry_date ? formatDay(row.entry_date) : '—'}</td><td>{formatDate(row.submitted_at)}</td><td>{submissionStatus(row)}</td>
                    <td>{row.overall_score === null ? '—' : `${Math.round(row.overall_score)}/100`}</td>
                    <td><button className="text-button" type="button" onClick={() => openSubmission(row.id)}>Open</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p>No forms submitted yet.</p>}
      </section>
    </div>
  );
}

// Read-only member progress for allowlisted admins. Every search, view, note
// and export is recorded in the admin access log by the server.
export default function AdminProgress() {
  const [term, setTerm] = useState('');
  const [query, setQuery] = useState('');
  const [state, setState] = useState({ loading: true, error: '', members: [] });
  const [selected, setSelected] = useState('');

  useEffect(() => {
    fetch(`/api/admin/progress?q=${encodeURIComponent(query)}`)
      .then((response) => readJson(response, 'Members could not be loaded.'))
      .then((data) => setState({ loading: false, error: '', members: data.members }))
      .catch((error) => setState({ loading: false, error: error.message, members: [] }));
  }, [query]);

  if (selected) return <MemberProgress id={selected} onClose={() => setSelected('')} />;
  return (
    <section className="profile-panel">
      <h2>Member progress</h2>
      <form className="admin-search" role="search" onSubmit={(event) => { event.preventDefault(); if (term.trim() !== query) { setState((current) => ({ ...current, loading: true })); setQuery(term.trim()); } }}>
        <label className="sr-only" htmlFor="member-search">Search members by name or email</label>
        <input id="member-search" className="wq-input" type="search" value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Search by name or email" />
        <button className="member-button" type="submit">Search</button>
      </form>
      {state.error && <p className="onboarding-error" role="alert">{state.error}</p>}
      {state.loading ? <BrandLoader label="Loading members…" /> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Name</th><th>Email</th><th>Welcome form</th><th>Baseline</th><th>Check-ins</th><th>Missed</th><th>Latest score</th><th>Last check-in</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {state.members.map((member) => (
                <tr key={member.id}>
                  <td>{member.display_name}</td>
                  <td>{member.email || '—'}</td>
                  <td>{member.welcome_completed_at ? <>Done {formatDate(member.welcome_completed_at)}{member.welcome_baseline_date && <><br /><small>Baseline date {formatDay(member.welcome_baseline_date)}</small></>}</> : 'Not started'}</td>
                  <td>{member.baseline_date ? formatDay(member.baseline_date) : 'Not started'}</td>
                  <td>{member.checkins}</td>
                  <td>{member.missed ?? '—'}</td>
                  <td>{member.latest_score === null ? '—' : `${Math.round(member.latest_score)}/100`}</td>
                  <td>{member.last_checkin_date ? formatDay(member.last_checkin_date) : '—'}</td>
                  <td><button className="text-button" type="button" onClick={() => setSelected(member.id)}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!state.members.length && <p>No members match.</p>}
        </div>
      )}
    </section>
  );
}
