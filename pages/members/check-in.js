import { useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import SEO from '../../components/SEO';
import BrandLoader from '../../components/BrandLoader';
import CheckInForm from '../../components/progress/CheckInForm';
import ProgressOverview from '../../components/progress/ProgressOverview';
import { ProgressConsentForm } from '../../components/progress/ProgressConsent';
import { Change } from '../../components/progress/ScoreChart';
import { useMemberData } from '../../utils/use-member-data';
import { scoreDisclaimer } from '../../utils/progress-checkin.mjs';
import { buildTimeline, weekLabel } from '../../utils/progress-timeline.mjs';

const seo = <SEO title="Weekly check-in | Unboxed Together" description="Your private weekly check-in." path="/members/check-in" />;
const longDate = (date) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

function Saved({ result }) {
  const timeline = useMemo(() => buildTimeline(result.state.entries, result.state.currentWeek.number), [result]);
  const week = timeline.weeks.find((item) => item.submissionId === result.submissionId);
  const baseline = week?.weekNumber === 0;
  return (
    <>
      <section className="checkin-saved" role="status">
        <p className="checkin-saved__title">{baseline ? 'Your baseline assessment has been saved.' : 'Your weekly check-in has been saved.'}</p>
        {week && (
          <p>
            {weekLabel(week.weekNumber)}: {week.status === 'complete' ? <strong>{Math.round(week.overall)}/100</strong> : <strong>incomplete, so no overall score</strong>}
            {week.change !== null && <> · <Change delta={week.change} comparedWeek={week.previousWeekNumber} /></>}
            {baseline && week.status === 'complete' && ' · This is your starting point.'}
          </p>
        )}
        <div className="card-actions"><Link className="member-button" href="/members/progress">Go to my progress</Link><Link className="member-button secondary" href="/members">Back to my dashboard</Link></div>
      </section>
      <ProgressOverview entries={result.state.entries} currentWeekNumber={result.state.currentWeek.number} initialOpenWeek={week?.weekNumber ?? null} />
    </>
  );
}

function CheckIn({ initial }) {
  const router = useRouter();
  const [progress, setProgress] = useState(initial);
  const [result, setResult] = useState(null);
  const correcting = router.query.correct;

  let body;
  if (result) {
    body = <Saved result={result} />;
  } else if (progress.state === 'needs_consent') {
    body = <section className="onboarding-card wq-card"><ProgressConsentForm onGiven={setProgress} /></section>;
  } else {
    const thisWeek = progress.entries.find((entry) => entry.rootId === progress.thisWeekRootId);
    const baselineEntry = progress.entries.find((entry) => entry.rootId === progress.baselineRootId);
    const correctingWeek = correcting === 'week' && progress.state === 'done' && thisWeek;
    const correctingBaseline = correcting === 'baseline' && progress.canCorrectBaseline && baselineEntry;
    const formType = progress.state === 'needs_baseline' || correctingBaseline ? 'baseline_wellbeing' : 'weekly_checkin';
    const draft = progress.drafts?.[formType];
    const open = progress.state === 'needs_baseline' || progress.state === 'due' || correctingWeek || correctingBaseline;
    const usedPrefill = formType === 'baseline_wellbeing' && !draft && !correctingBaseline && Object.keys(progress.prefill || {}).length > 0;

    body = open ? (
      <section className="onboarding-card wq-card checkin-card">
        <p className="wq-tagline">{correctingWeek || correctingBaseline ? 'Correcting your answers' : formType === 'baseline_wellbeing' ? 'Baseline · Week 0' : `Week ${progress.currentWeek.number} check-in`}</p>
        {formType === 'baseline_wellbeing' && !correctingBaseline && <p className="wq-paragraph">Your baseline is your starting point. It uses the same questions as every weekly check-in, so your scores can be compared fairly. It will not change when you complete later check-ins.</p>}
        {usedPrefill && <p className="ci-prefill">Some answers are filled in from page 3 of your welcome questionnaire. Please check they still describe the past 7 days.</p>}
        {draft && <p className="ci-prefill">We have restored the answers you saved earlier.</p>}
        <CheckInForm
          key={`${formType}-${correcting || 'new'}`}
          formType={formType}
          initialAnswers={correctingWeek ? thisWeek.answers : correctingBaseline ? baselineEntry.answers : draft?.answers || progress.prefill}
          draftSavedAt={draft?.updatedAt}
          revisionOf={correctingWeek ? thisWeek.rootId : correctingBaseline ? baselineEntry.rootId : null}
          revisionReasons={progress.revisionReasons}
          onCancel={correctingWeek || correctingBaseline ? () => router.push('/members/progress') : undefined}
          onSaved={(saved) => { setResult(saved); window.scrollTo({ top: 0 }); }}
        />
        <p className="score-disclaimer">{scoreDisclaimer}</p>
      </section>
    ) : (
      <section className="onboarding-card wq-card">
        <h1>{progress.state === 'waiting' ? 'Your baseline is saved' : 'This week is done'}</h1>
        <p className="wq-paragraph">
          {progress.state === 'waiting'
            ? `Your first weekly check-in opens on ${longDate(progress.nextCheckInOpens)}.`
            : 'You have already completed this week’s check-in. Each week has one check-in so your scores stay comparable. You can correct this week’s answers until Sunday.'}
        </p>
        <div className="card-actions">
          <Link className="member-button" href="/members/progress">See my progress</Link>
          {progress.state === 'done' && <Link className="member-button secondary" href="/members/check-in?correct=week">Correct this week’s answers</Link>}
          {progress.state === 'waiting' && progress.canCorrectBaseline && <Link className="member-button secondary" href="/members/check-in?correct=baseline">Correct my baseline answers</Link>}
        </div>
      </section>
    );
  }

  return (
    <Layout>
      {seo}
      <Head><meta name="robots" content="noindex, nofollow" /></Head>
      <div className="member-page checkin-page">
        <nav className="dashboard-nav" aria-label="Member sections">
          <Link href="/members">Dashboard</Link>
          <Link href="/members/progress">My progress</Link>
          <Link href="/members/forms">My forms &amp; assessments</Link>
        </nav>
        {body}
      </div>
    </Layout>
  );
}

export default function CheckInPage() {
  const { data, loading, error } = useMemberData('/api/progress');
  if (error || loading || !data) {
    return <Layout>{seo}<div className="member-page">{error ? <p className="onboarding-error" role="alert">{error}</p> : <BrandLoader label="Loading your check-in…" />}</div></Layout>;
  }
  return <CheckIn initial={data} />;
}
