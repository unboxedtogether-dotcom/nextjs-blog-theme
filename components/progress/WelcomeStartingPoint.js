import { formatDay } from './ProgressOverview';

// Question 22 on page 3 of the welcome questionnaire, dated by the member's
// own baseline date. Shown next to progress; not scored or charted.
export default function WelcomeStartingPoint({ point, mode = 'member' }) {
  if (!point) return null;
  return (
    <section className="profile-panel welcome-start" aria-labelledby="welcome-start-heading">
      <h2 id="welcome-start-heading">Welcome questionnaire starting point</h2>
      <p>
        {point.date ? <>Dated <strong>{formatDay(point.date)}</strong></> : 'No baseline date given'}
        {point.savedAt && <> · saved {new Date(point.savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</>}.
        {' '}{mode === 'admin' ? 'The member’s' : 'Your'} 1 to 5 answers from page 3 (past 7 days). These are kept separately from the weekly scores out of 100.
      </p>
      <dl className="welcome-start__scores">
        {point.scores.map((row) => (
          <div key={row.key}><dt>{row.label}</dt><dd>{row.value === null ? <span className="admin-empty">Not answered</span> : `${row.value} of 5`}</dd></div>
        ))}
      </dl>
    </section>
  );
}
