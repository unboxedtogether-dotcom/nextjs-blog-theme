import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout from '../Layout';
import SEO from '../SEO';
import ProgressOverview from './ProgressOverview';
import { ProgressConsentManager } from './ProgressConsent';
import WelcomeStartingPoint from './WelcomeStartingPoint';

export const progressSeo = <SEO title="My progress | Unboxed Together" description="Your private weekly progress." path="/members/progress" />;
const longDate = (date) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const addDays = (date, count) => new Date(Date.parse(`${date}T00:00:00Z`) + count * 86400000).toISOString().slice(0, 10);

export function CheckInPrompt({ progress }) {
  const draft = progress.drafts?.weekly_checkin || progress.drafts?.baseline_wellbeing;
  const prompts = {
    needs_consent: ['Start tracking your progress', 'A short weekly check-in about sleep, mood, energy and focus, food habits and movement. You choose whether to take part.', 'Find out more', '/members/check-in'],
    needs_baseline: [draft ? 'Continue your baseline' : 'Set your starting point', 'Your baseline is Week 0. It takes about 3 minutes and stays as your starting point.', draft ? 'Continue my baseline' : 'Start my baseline', '/members/check-in'],
    waiting: ['Your baseline is saved', `Your first weekly check-in opens on ${progress.nextCheckInOpens ? longDate(progress.nextCheckInOpens) : 'Monday'}.`, progress.canCorrectBaseline ? 'Correct my baseline answers' : null, '/members/check-in?correct=baseline'],
    due: [draft ? 'Continue this week’s check-in' : 'This week’s check-in is ready', `Week ${progress.currentWeek.number}. Around 2 to 3 minutes, mostly tapping answers.`, draft ? 'Continue my check-in' : 'Start my check-in', '/members/check-in'],
    done: ['This week’s check-in is done', `Your next check-in opens on ${longDate(addDays(progress.currentWeek.start, 7))}.`, 'Correct this week’s answers', '/members/check-in?correct=week'],
  };
  const [title, text, action, href] = prompts[progress.state];
  const missed = progress.state === 'done' ? progress.missedWeeks || [] : [];
  return (
    <section className={`checkin-prompt is-${progress.state}`} aria-live="polite">
      <div><h2>{title}</h2><p>{text}</p></div>
      <div className="card-actions">
        {missed.length > 0 && <Link className="member-button" href="/members/check-in?missed=1">Add a missed week ({missed.length})</Link>}
        {action && <Link className={`member-button${['done', 'waiting'].includes(progress.state) ? ' secondary' : ''}`} href={href}>{action}</Link>}
      </div>
    </section>
  );
}

export default function ProgressPage({ initial, preview = false, notice = null }) {
  const router = useRouter();
  const [progress, setProgress] = useState(initial);
  const hasRecords = progress.entries.length > 0;

  const addNote = async (submissionId, body) => {
    const response = await fetch('/api/progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'note', submissionId, body }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Your note could not be saved.');
    setProgress(data.state);
  };

  return (
    <Layout>
      {progressSeo}
      {notice}
      <Head><meta name="robots" content="noindex, nofollow" /></Head>
      <div className="member-page progress-page">
        <header className="member-hero compact">
          <p className="member-kicker">Private to you</p>
          <h1>My progress</h1>
          <p>Your weekly scores out of 100, built from your own answers. Higher scores mean you reported better wellbeing or more consistent habits that week.</p>
        </header>
        <nav className="dashboard-nav" aria-label="Member sections">
          <Link href="/members">Dashboard</Link>
          <Link href="/members/progress" className="is-active" aria-current="page">My progress</Link>
          <Link href="/members/forms">My forms &amp; assessments</Link>
        </nav>
        <CheckInPrompt progress={progress} />
        {hasRecords ? (
          <ProgressOverview
            entries={progress.entries}
            currentWeekNumber={progress.currentWeek.number}
            onAddNote={preview ? undefined : addNote}
            onOpenSubmission={preview ? undefined : (rootId) => router.push(`/members/forms?id=${encodeURIComponent(rootId)}`)}
          />
        ) : (
          <section className="profile-panel"><h2>Nothing to show yet</h2><p>Your chart and weekly history appear here once you have completed your baseline assessment.</p></section>
        )}
        <WelcomeStartingPoint point={progress.welcomeStartingPoint} />
        <div className="progress-footer">
          {!preview && hasRecords && <a className="member-button secondary" href="/api/forms/export?format=pdf">Download my progress report (PDF)</a>}
          {!preview && <ProgressConsentManager consent={progress.consent} onWithdrawn={setProgress} />}
        </div>
      </div>
    </Layout>
  );
}
