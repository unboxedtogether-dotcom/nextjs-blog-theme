import Link from 'next/link';
import { Change } from '../progress/ScoreChart';
import { weekLabel } from '../../utils/progress-timeline.mjs';

const longDate = (date) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const prompts = {
  needs_consent: ['Start tracking', 'A short weekly check-in about sleep, mood, energy and focus, food habits and movement.'],
  needs_baseline: ['Set your starting point', 'Complete your baseline (Week 0). It takes about 3 minutes.'],
  due: ['This week’s check-in is ready', 'Around 2 to 3 minutes, mostly tapping answers.'],
  done: ['This week’s check-in is done', 'Thank you. See how this week compares.'],
};

// MY PROGRESS summary on the dashboard; the full chart and history are on /members/progress.
export default function ProgressCard({ progress }) {
  const { summary, state } = progress;
  const [title, text] = state === 'waiting'
    ? ['Your baseline is saved', `Your first weekly check-in opens on ${progress.nextCheckInOpens ? longDate(progress.nextCheckInOpens) : 'Monday'}.`]
    : prompts[state];
  const showCheckIn = ['needs_consent', 'needs_baseline', 'due'].includes(state);
  return (
    <section className="dashboard-card progress-summary-card" aria-labelledby="my-progress-heading">
      <span>My progress</span>
      <h2 id="my-progress-heading">{title}</h2>
      <p>{progress.hasDraft && showCheckIn ? 'You have saved answers waiting. Pick up where you left off.' : text}</p>
      {summary.baselineScore !== null && (
        <dl className="progress-mini">
          <div><dt>Current</dt><dd>{summary.currentScore === null ? '—' : `${Math.round(summary.currentScore)}/100`}</dd></div>
          <div><dt>Change</dt><dd>{summary.change === null ? '—' : <Change delta={summary.change} comparedWeek={summary.previousWeekNumber} compact />}</dd></div>
          <div><dt>Baseline</dt><dd>{Math.round(summary.baselineScore)}/100</dd></div>
        </dl>
      )}
      {summary.currentWeekNumber !== null && <p className="dashboard-note">Latest: {weekLabel(summary.currentWeekNumber)}, {new Date(summary.lastCheckInAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}. Scores are self-monitoring indicators, not a medical assessment.</p>}
      <div className="card-actions">
        {showCheckIn && <Link className="member-button" href="/members/check-in">{progress.hasDraft ? 'Continue' : state === 'needs_consent' ? 'Find out more' : state === 'needs_baseline' ? 'Start my baseline' : 'Start my check-in'}</Link>}
        <Link className={`member-button${showCheckIn ? ' secondary' : ''}`} href="/members/progress">Open my progress</Link>
        <Link className="member-button secondary" href="/members/forms">My forms &amp; assessments</Link>
      </div>
    </section>
  );
}
