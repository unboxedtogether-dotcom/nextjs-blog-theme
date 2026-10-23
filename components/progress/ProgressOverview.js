import { useMemo, useState } from 'react';
import ScoreChart, { Change } from './ScoreChart';
import { describeCheckinAnswers, scoreCategories, scoreDisclaimer } from '../../utils/progress-checkin.mjs';
import { buildTimeline, periods, weekLabel, weeksInPeriod } from '../../utils/progress-timeline.mjs';

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
const formatDateTime = (value) => (value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '');
export const formatDay = (date) => (date ? new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '');
const weekRange = (start) => {
  if (!start) return '';
  const from = new Date(`${start}T12:00:00Z`);
  const to = new Date(from.getTime() + 6 * 86400000);
  const options = { day: 'numeric', month: 'short', timeZone: 'UTC' };
  return `${from.toLocaleDateString('en-GB', options)} – ${to.toLocaleDateString('en-GB', options)}`;
};

function Tile({ label, value, detail, children }) {
  return (
    <div className="progress-tile">
      <span>{label}</span>
      <strong>{value}</strong>
      {children}
      {detail && <small>{detail}</small>}
    </div>
  );
}

export function ProgressSummary({ summary }) {
  const outOf = (value) => (value === null ? '—' : <>{Math.round(value)}<em>/100</em></>);
  return (
    <div className="progress-tiles">
      <Tile label="Current weekly score" value={outOf(summary.currentScore)} detail={summary.currentScore === null ? 'After your first weekly check-in' : weekLabel(summary.currentWeekNumber)} />
      <Tile label="Previous score" value={outOf(summary.previousScore)} detail={summary.previousWeekNumber === null ? '' : weekLabel(summary.previousWeekNumber)} />
      <Tile label="Change" value={summary.change === null ? '—' : <Change delta={summary.change} comparedWeek={summary.previousWeekNumber} compact />} detail="Since the previous completed week" />
      <Tile label="Baseline score" value={outOf(summary.baselineScore)} detail={summary.baselineScore === null ? 'Not available' : 'Week 0'} />
      <Tile label="Change from baseline" value={summary.changeFromBaseline === null ? '—' : <Change delta={summary.changeFromBaseline} comparedWeek={0} compact />} detail="Total, in points" />
      <Tile label="Last check-in" value={summary.lastCheckInAt ? new Date(summary.lastCheckInAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'} detail={summary.lastCheckInAt ? new Date(summary.lastCheckInAt).getFullYear() : 'None completed yet'} />
    </div>
  );
}

function CategoryBars({ week }) {
  return (
    <ul className="category-bars">
      {scoreCategories.map((category) => {
        const current = week.categories?.[category.key]?.score;
        const before = week.previousCategories?.[category.key]?.score;
        const hasScore = current !== null && current !== undefined;
        return (
          <li key={category.key}>
            <div className="category-bars__head">
              <span>{category.fullLabel} <small>{Math.round(category.weight * 100)}% of total</small></span>
              <strong>{hasScore ? `${Math.round(current)}/100` : 'Not enough answers'}</strong>
            </div>
            <div className="category-bars__track" aria-hidden="true">
              {hasScore && <span className="category-bars__fill" style={{ width: `${current}%` }} />}
              {before !== null && before !== undefined && <span className="category-bars__marker" style={{ left: `${before}%` }} title={`${weekLabel(week.previousWeekNumber)}: ${Math.round(before)}`} />}
            </div>
            <div className="category-bars__compare">
              {before !== null && before !== undefined ? <>{weekLabel(week.previousWeekNumber)}: {Math.round(before)}/100 {week.categoryChanges?.[category.key] !== null && <Change delta={week.categoryChanges[category.key]} comparedWeek={week.previousWeekNumber} compact />}</> : week.weekNumber === 0 ? 'Starting point' : 'No earlier completed week to compare'}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function AnswerRows({ answers }) {
  const rows = describeCheckinAnswers(answers);
  const groups = [...new Set(rows.map((row) => row.group))];
  return groups.map((group) => (
    <div key={group} className="answer-group">
      <h5>{group}</h5>
      <dl className="admin-answers">
        {rows.filter((row) => row.group === group).map((row) => (
          <div key={row.key}><dt>{row.label}</dt><dd>{row.value ?? <span className="admin-empty">Not answered</span>}</dd></div>
        ))}
      </dl>
    </div>
  ));
}

function NoteForm({ onSave }) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState({ saving: false, error: '' });
  const save = async (event) => {
    event.preventDefault();
    setStatus({ saving: true, error: '' });
    try {
      await onSave(text);
      setText('');
      setStatus({ saving: false, error: '' });
    } catch (error) {
      setStatus({ saving: false, error: error.message });
    }
  };
  return (
    <form className="note-form" onSubmit={save}>
      <textarea className="wq-input wq-textarea" value={text} maxLength={2000} onChange={(event) => setText(event.target.value)} aria-label="Add a note about this week" placeholder="Add a note about this week" />
      {status.error && <p className="onboarding-error" role="alert">{status.error}</p>}
      <button className="member-button secondary" type="submit" disabled={status.saving || !text.trim()}>{status.saving ? 'Saving…' : 'Save note'}</button>
    </form>
  );
}

function WeekCard({ week, open, onToggle, mode, onAddNote, onOpenSubmission }) {
  const headingId = `week-${week.weekNumber}-heading`;
  if (week.status === 'missed' || week.status === 'due') {
    return (
      <li className={`week-card is-${week.status}`}>
        <div className="week-card__head is-static">
          <span className="week-card__week">{weekLabel(week.weekNumber)}</span>
          <span className="week-card__score">{week.status === 'due' ? 'Due this week' : 'No check-in this week'}</span>
          <span className="week-card__note">Not counted as zero</span>
        </div>
      </li>
    );
  }
  const memberNotes = (week.notes || []).filter((note) => note.authorRole === 'member');
  const adminNotes = (week.notes || []).filter((note) => note.authorRole === 'admin');
  return (
    <li className={`week-card is-${week.status}${open ? ' is-open' : ''}`} id={`week-${week.weekNumber}`}>
      <button type="button" className="week-card__head" aria-expanded={open} aria-controls={`${headingId}-panel`} onClick={onToggle}>
        <span className="week-card__week" id={headingId}>{weekLabel(week.weekNumber)}</span>
        <span className="week-card__score">{week.status === 'complete' ? <>{Math.round(week.overall)}<em>/100</em></> : 'Incomplete'}</span>
        <span className="week-card__note">{week.status === 'incomplete' ? 'Not scored' : week.change !== null ? <Change delta={week.change} comparedWeek={week.previousWeekNumber} compact /> : week.weekNumber === 0 ? 'Starting point' : ''}</span>
        <span className="week-card__chevron" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="week-card__panel" id={`${headingId}-panel`} role="region" aria-labelledby={headingId}>
          <div className="week-card__meta">
            {week.entryDate && <span>Dated {formatDay(week.entryDate)}</span>}
            <span>Week of {weekRange(week.weekStart)}</span>
            <span>Saved {formatDateTime(week.submittedAt)}</span>
            {week.revisionNumber > 0 && <span>Corrected (correction {week.revisionNumber}). First submitted {formatDateTime(week.originalSubmittedAt)}</span>}
          </div>
          <div className="week-card__overall">
            <div><span>Overall score</span><strong>{week.status === 'complete' ? `${Math.round(week.overall)}/100` : 'Not calculated'}</strong></div>
            <div><span>Change from previous completed week</span><strong>{week.change !== null ? <Change delta={week.change} comparedWeek={week.previousWeekNumber} /> : week.status === 'incomplete' ? 'Not compared (incomplete)' : '—'}</strong></div>
          </div>
          {week.status === 'incomplete' && <p className="week-card__incomplete">Some required questions were left blank, so this week has no overall score and is not used in comparisons. Category scores are shown where enough answers were given.</p>}
          <CategoryBars week={week} />
          <details className="week-card__answers">
            <summary>Original submitted answers</summary>
            <AnswerRows answers={week.answers} />
          </details>
          <div className="week-card__notes">
            <h4>{mode === 'admin' ? 'Member notes' : 'My notes'}</h4>
            {week.answers?.personalNote && <p className="note-item">{week.answers.personalNote} <small>(written with the check-in)</small></p>}
            {memberNotes.map((note) => <p key={note.id} className="note-item">{note.body} <small>{formatDate(note.createdAt)}</small></p>)}
            {!week.answers?.personalNote && !memberNotes.length && <p className="note-empty">No notes for this week.</p>}
            {mode === 'admin' && (
              <>
                <h4>Private team notes</h4>
                {adminNotes.length ? adminNotes.map((note) => <p key={note.id} className="note-item is-private">{note.body} <small>{formatDateTime(note.createdAt)}</small></p>) : <p className="note-empty">No private notes.</p>}
              </>
            )}
            {onAddNote && <NoteForm onSave={(text) => onAddNote(week.submissionId, text)} />}
          </div>
          {onOpenSubmission && <button type="button" className="text-button" onClick={() => onOpenSubmission(week.rootId)}>View the complete original submission{week.revisions?.length > 1 ? ' and corrections' : ''}</button>}
        </div>
      )}
    </li>
  );
}

// Summary tiles, chart and weekly cards. Shared by MY PROGRESS and the admin view.
export default function ProgressOverview({ entries, currentWeekNumber, mode = 'member', onAddNote, onOpenSubmission, initialOpenWeek = null }) {
  const timeline = useMemo(() => buildTimeline(entries, currentWeekNumber), [entries, currentWeekNumber]);
  const [period, setPeriod] = useState('8');
  const [openWeeks, setOpenWeeks] = useState(() => new Set(initialOpenWeek === null ? [] : [initialOpenWeek]));
  const visible = weeksInPeriod(timeline.weeks, period);

  const select = (weekNumber) => {
    setOpenWeeks((current) => new Set([...current, weekNumber]));
    window.requestAnimationFrame(() => document.getElementById(`week-${weekNumber}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const toggle = (weekNumber) => setOpenWeeks((current) => {
    const next = new Set(current);
    if (next.has(weekNumber)) next.delete(weekNumber); else next.add(weekNumber);
    return next;
  });

  return (
    <div className="progress-overview">
      <ProgressSummary summary={timeline.summary} />
      <section className="profile-panel progress-chart-panel" aria-labelledby="chart-heading">
        <div className="progress-chart-panel__head">
          <h2 id="chart-heading">Overall score over time</h2>
          <div className="review-filters" role="group" aria-label="Time period">
            {periods.map((item) => <button key={item.key} type="button" className={period === item.key ? 'is-active' : ''} aria-pressed={period === item.key} onClick={() => setPeriod(item.key)}>{item.label}</button>)}
          </div>
        </div>
        <ScoreChart weeks={visible} baselineScore={timeline.summary.baselineScore} onSelect={select} />
        <p className="score-disclaimer">{scoreDisclaimer}</p>
      </section>
      <section className="progress-history" aria-labelledby="history-heading">
        <h2 id="history-heading">Week by week</h2>
        <p className="progress-history__intro">Select a week to see each category, what changed since the previous completed week, and the answers you gave.</p>
        {timeline.weeks.length ? (
          <ol className="week-cards">
            {timeline.weeks.slice().reverse().map((week) => (
              <WeekCard key={week.weekNumber} week={week} mode={mode} open={openWeeks.has(week.weekNumber)} onToggle={() => toggle(week.weekNumber)} onAddNote={onAddNote} onOpenSubmission={onOpenSubmission} />
            ))}
          </ol>
        ) : <p>No assessments yet.</p>}
      </section>
    </div>
  );
}
