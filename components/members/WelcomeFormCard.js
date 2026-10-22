import Link from 'next/link';
import { questionnaireSections } from '../../utils/welcome-questionnaire.mjs';

const formatDate = (value) => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export function sectionStatus(questionnaire, number) {
  if (number === 1) return questionnaire.welcomeCompletedAt ? { label: 'Complete', done: true } : { label: 'Not started' };
  const savedAt = questionnaire.healthConsentGivenAt && questionnaire.sectionSavedAt[number];
  return savedAt ? { label: `Saved ${formatDate(savedAt)}`, done: true } : { label: 'Optional · not started' };
}

// Links into the existing questionnaire at /onboarding; it is not duplicated here.
export default function WelcomeFormCard({ questionnaire }) {
  const states = questionnaireSections.map((section) => ({ section, ...sectionStatus(questionnaire, section.number) }));
  const completed = states.filter((state) => state.done).length;
  const nextPage = states.find((state) => !state.done)?.section.number;
  const percent = Math.round((completed / questionnaireSections.length) * 100);

  return (
    <section className="dashboard-card welcome-form-card" aria-labelledby="welcome-form-heading">
      <span>My welcome form</span>
      <h2 id="welcome-form-heading">{completed === questionnaireSections.length ? 'All pages saved' : `${completed} of ${questionnaireSections.length} pages saved`}</h2>
      <div className="welcome-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Welcome form completion"><span style={{ width: `${percent}%` }} /></div>
      <ol className="questionnaire-status">
        {states.map(({ section, label, done }) => <li key={section.number} className={done ? 'is-done' : ''}><strong>{section.number}. {section.title}</strong><em>{label}</em></li>)}
      </ol>
      <p className="dashboard-note">Page 1 is all you need to join. Pages 2 to 4 are optional and can be completed another time, or talked through with Lee.</p>
      <div className="card-actions">
        {nextPage && <Link className="member-button" href={`/onboarding?page=${nextPage}`}>Continue questionnaire</Link>}
        <Link className={`member-button${nextPage ? ' secondary' : ''}`} href="/onboarding?page=1">Review or update answers</Link>
      </div>
    </section>
  );
}
