import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import SEO from '../components/SEO';
import BrandLogo from '../components/BrandLogo';
import { baselineFromDatabase, onboardingQuestions } from '../utils/onboarding-options';
import { useMemberData } from '../utils/use-member-data';

function Choice({ selected, children, onClick }) {
  return <button type="button" className={`onboarding-choice${selected ? ' is-selected' : ''}`} aria-pressed={selected} onClick={onClick}>{children}</button>;
}

export default function Onboarding() {
  const router = useRouter();
  const { data, loading, error } = useMemberData();
  const editing = router.query.edit === '1';

  useEffect(() => {
    if (!loading && data?.profile?.onboarding_completed && !editing) router.replace('/members');
  }, [data, editing, loading, router]);

  if (error) {
    return <main className="onboarding-page" id="main-content"><SEO title="Your starting point | Unboxed Together" description="Set a personal starting point for your Unboxed Together membership." path="/onboarding" /><p className="onboarding-error" role="alert">{error}</p></main>;
  }

  if (loading || !data?.profile || (data.profile.onboarding_completed && !editing)) {
    return <main className="onboarding-page" id="main-content"><SEO title="Your starting point | Unboxed Together" description="Set a personal starting point for your Unboxed Together membership." path="/onboarding" /><p className="auth-loading">Loading your starting point…</p></main>;
  }

  return <OnboardingForm initialBaseline={baselineFromDatabase(data.baseline)} editing={editing} />;
}

function OnboardingForm({ initialBaseline, editing }) {
  const router = useRouter();
  const [answers, setAnswers] = useState(initialBaseline);
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState({ saving: false, error: '' });
  const question = onboardingQuestions[step];
  const finalStep = step === onboardingQuestions.length;
  const progress = Math.round(((step + (finalStep ? 0 : 1)) / onboardingQuestions.length) * 100);

  const setAnswer = (key, value) => setAnswers((current) => ({ ...current, [key]: value }));
  const toggle = (key, value, max) => {
    const current = answers[key];
    if (current.includes(value)) setAnswer(key, current.filter((item) => item !== value));
    else if (current.length < max) setAnswer(key, [...current, value]);
  };
  const isAnswered = !question || question.optional || (Array.isArray(answers[question.key]) ? answers[question.key].length > 0 : answers[question.key] !== null && answers[question.key] !== '');
  const next = () => {
    if (!isAnswered) return setStatus({ saving: false, error: 'Choose an answer to continue.' });
    setStatus({ saving: false, error: '' });
    setStep((current) => current + 1);
  };
  const save = async () => {
    setStatus({ saving: true, error: '' });
    const response = await fetch('/api/member', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseline: answers }) });
    const data = response.status === 204 ? {} : await response.json();
    if (!response.ok) return setStatus({ saving: false, error: data.error || 'We could not save your answers.' });
    router.push(editing ? '/members/profile?saved=1' : '/members');
  };

  return (
    <main className="onboarding-page" id="main-content">
      <SEO title={`${editing ? 'Review your answers' : 'Your starting point'} | Unboxed Together`} description="Set a personal starting point for your Unboxed Together membership." path="/onboarding" />
      <header className="onboarding-header"><BrandLogo /><span>{editing ? 'Review answers' : 'Your starting point'}</span></header>
      <div className="onboarding-progress" aria-label={`Onboarding progress: ${progress}%`}><span style={{ width: `${progress}%` }} /></div>
      <section className="onboarding-card">
        {!finalStep ? (
          <>
            <p className="onboarding-count">Question {step + 1} of {onboardingQuestions.length}</p>
            <h1>{question.heading}</h1>
            {question.help && <p className="onboarding-help">{question.help}</p>}
            <div className={`onboarding-options onboarding-options-${question.type}`}>
              {question.type === 'multi' && question.options.map((option) => <Choice key={option} selected={answers[question.key].includes(option)} onClick={() => toggle(question.key, option, question.max)}>{option}</Choice>)}
              {question.type === 'single' && question.options.map((option) => <Choice key={option} selected={answers[question.key] === option} onClick={() => setAnswer(question.key, option)}>{option}</Choice>)}
              {question.type === 'score' && question.options.map((option, index) => <Choice key={option} selected={answers[question.key] === index + 1} onClick={() => setAnswer(question.key, index + 1)}><span className="choice-number">{index + 1}</span>{option}</Choice>)}
              {question.type === 'scale' && <><div className="scale-labels"><span>1 — {question.low}</span><span>5 — {question.high}</span></div><div className="scale-buttons">{[1, 2, 3, 4, 5].map((value) => <Choice key={value} selected={answers[question.key] === value} onClick={() => setAnswer(question.key, value)}>{value}</Choice>)}</div>{question.optional && <Choice selected={answers[question.key] === null} onClick={() => setAnswer(question.key, null)}>Prefer not to answer</Choice>}</>}
            </div>
            {status.error && <p className="onboarding-error" role="alert">{status.error}</p>}
            <div className="onboarding-actions">{step > 0 ? <button type="button" className="member-button secondary" onClick={() => setStep(step - 1)}>Back</button> : <span />}<button type="button" className="member-button" onClick={next}>Continue</button></div>
          </>
        ) : (
          <div className="onboarding-finish">
            <p className="onboarding-count">Starting point complete</p>
            <h1>You are ready to begin.</h1>
            <p>Your starting point has been saved. Over time, you will be able to revisit these same pillars and see what has changed for you.</p>
            <div className="onboarding-review"><strong>Your priorities</strong><p>{answers.improvementGoals.join(' · ')}</p></div>
            {status.error && <p className="onboarding-error" role="alert">{status.error}</p>}
            <div className="finish-actions"><button className="member-button" type="button" disabled={status.saving} onClick={save}>{status.saving ? 'Saving…' : editing ? 'Save my answers' : 'Enter my dashboard'}</button><button className="member-button secondary" type="button" onClick={() => setStep(0)}>Review my answers</button></div>
            <p className="onboarding-disclaimer">This information helps personalise your experience and measure changes over time. Unboxed Together is educational and is not a substitute for medical advice.</p>
          </div>
        )}
      </section>
      <p className="onboarding-privacy">Your answers stay connected to your account and are not sent to analytics. Read our <Link href="/privacy">Privacy Policy</Link>.</p>
    </main>
  );
}
