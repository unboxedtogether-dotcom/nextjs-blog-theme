import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import SEO from '../../components/SEO';
import BrandLogo from '../../components/BrandLogo';
import { useAuth } from '../../components/auth/AuthProvider';
import {
  consentTexts, emptyProspectAnswers, hasSensitiveChallenge, joinResultKey, joinSourceKey, prospectQuestions, questionError, sensitiveConsentText, toggleOption,
} from '../../utils/prospect-questionnaire.mjs';

const seo = <SEO title="Help shape Unboxed Together | Questionnaire" description="A short, two-minute questionnaire about what you'd like to understand and how you'd like to get involved." path="/join-us/questionnaire" />;
const totalSteps = prospectQuestions.length + 1;

export default function ProspectQuestionnaire() {
  const { user, loading } = useAuth();
  return (
    <main className="onboarding-page join-q" id="main-content">
      {seo}
      <Head><meta name="robots" content="noindex" /></Head>
      <header className="onboarding-header"><BrandLogo /><span>Help shape Unboxed Together</span></header>
      {!loading && user ? <AlreadyMember /> : <Questionnaire />}
      <p className="onboarding-privacy">No account is needed and your answers are not sent to analytics. Read our <Link href="/privacy#registering-interest">Privacy Notice</Link>.</p>
    </main>
  );
}

function AlreadyMember() {
  return (
    <section className="onboarding-card join-q__card">
      <p className="onboarding-count">You&apos;re signed in</p>
      <h1>You&apos;re already part of Unboxed Together.</h1>
      <p className="wq-paragraph">This short questionnaire is for people who haven&apos;t joined yet. Your dashboard has your welcome form, progress and ways to contact us.</p>
      <div className="finish-actions"><Link className="member-button" href="/members">Go to my dashboard</Link></div>
    </section>
  );
}

function Questionnaire() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(emptyProspectAnswers);
  const [sensitiveConsent, setSensitiveConsent] = useState(false);
  const [details, setDetails] = useState({ firstName: '', email: '', project_contact: false, general_marketing: false, website: '' });
  const [status, setStatus] = useState({ saving: false, error: '' });
  // One key per questionnaire: repeated clicks or retries can never store it twice.
  const [idempotencyKey] = useState(() => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : ''));
  const startedAt = useRef(0);
  const heading = useRef(null);

  useEffect(() => { startedAt.current = Date.now(); }, []);
  useEffect(() => { heading.current?.focus(); }, [step]);

  const question = prospectQuestions[step];
  const selected = question ? answers[question.key] : [];
  const needsConsent = question?.sensitive && hasSensitiveChallenge(selected);
  const goTo = (next) => { setStatus({ saving: false, error: '' }); setStep(next); window.scrollTo({ top: 0 }); };

  const next = () => {
    const error = questionError(question, selected);
    if (error) return setStatus({ saving: false, error });
    if (needsConsent && !sensitiveConsent) return setStatus({ saving: false, error: 'Please tick the consent box to keep this answer, or skip this question.' });
    goTo(step + 1);
  };
  const skip = () => {
    setAnswers((current) => ({ ...current, [question.key]: [] }));
    setSensitiveConsent(false);
    goTo(step + 1);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (status.saving) return;
    const wantsContact = details.project_contact || details.general_marketing;
    if (wantsContact && !details.email.trim()) return setStatus({ saving: false, error: 'Please add your email address so we can contact you, or untick the contact boxes.' });
    if (wantsContact && !details.firstName.trim()) return setStatus({ saving: false, error: 'Please add your first name so we know what to call you.' });
    setStatus({ saving: true, error: '' });
    // Passed on from a member's invitation link, if the visitor came from one.
    const referralToken = typeof router.query.ref === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(router.query.ref) ? router.query.ref : undefined;
    let source = '';
    try { source = window.sessionStorage.getItem(joinSourceKey) || ''; } catch { /* storage unavailable */ }
    try {
      const response = await fetch('/api/prospect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey,
          startedAt: startedAt.current,
          website: details.website,
          answers,
          firstName: details.firstName,
          email: details.email,
          consent: { project_contact: details.project_contact, general_marketing: details.general_marketing, sensitive_answers: sensitiveConsent },
          source: source || (referralToken ? 'member-referral' : ''),
          referralToken,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Your answers could not be sent. Please try again.');
      try { window.sessionStorage.setItem(joinResultKey, JSON.stringify({ contactRequested: data.contactRequested === true, marketingPending: data.marketingPending === true })); } catch { /* storage unavailable */ }
      router.replace(referralToken ? `/join-us/thank-you?ref=${encodeURIComponent(referralToken)}` : '/join-us/thank-you');
    } catch (error) {
      setStatus({ saving: false, error: error.message });
    }
  };

  return (
    <section className="onboarding-card join-q__card" aria-live="polite">
      <div className="join-q__progress">
        <p className="onboarding-count">Step {step + 1} of {totalSteps}</p>
        <div className="join-q__bar" role="progressbar" aria-label="Questionnaire progress" aria-valuemin={1} aria-valuemax={totalSteps} aria-valuenow={step + 1}><span style={{ width: `${((step + 1) / totalSteps) * 100}%` }} /></div>
      </div>

      {question ? (
        <form onSubmit={(event) => { event.preventDefault(); next(); }} noValidate>
          <fieldset className="join-q__question">
            <legend><h1 ref={heading} tabIndex={-1}>{question.title}</h1></legend>
            <p className="wq-tagline">{question.help}</p>
            <div className="join-q__choices">
              {question.options.map((option) => {
                const isSelected = selected.includes(option);
                return (
                  <button key={option} type="button" className={`onboarding-choice join-q__choice${isSelected ? ' is-selected' : ''}`} aria-pressed={isSelected}
                    onClick={() => { setStatus({ saving: false, error: '' }); setAnswers((current) => ({ ...current, [question.key]: toggleOption(question.key, current[question.key], option) })); }}>
                    <span className="join-q__tick" aria-hidden="true" />{option}
                  </button>
                );
              })}
            </div>
            {needsConsent && (
              <div className="join-q__consent">
                <p className="wq-help">Answers about your own experiences can count as health information. We only keep this answer if you agree.</p>
                <label className="wq-checkbox"><input type="checkbox" checked={sensitiveConsent} onChange={(event) => setSensitiveConsent(event.target.checked)} /><span>{sensitiveConsentText}</span></label>
              </div>
            )}
            {question.sensitive && <p className="join-q__disclaimer">This is not a medical assessment and your answers are not treated as a diagnosis.</p>}
          </fieldset>
          {status.error && <p className="onboarding-error" role="alert">{status.error}</p>}
          <div className="onboarding-actions wq-actions">
            {step > 0 ? <button type="button" className="member-button secondary" onClick={() => goTo(step - 1)}>Back</button> : <Link className="member-button secondary" href="/join-us">Back</Link>}
            <div>
              {question.optional && <button type="button" className="text-button" onClick={skip}>Skip this question</button>}
              <button type="submit" className="member-button">Continue</button>
            </div>
          </div>
        </form>
      ) : (
        <form onSubmit={submit} noValidate>
          <h1 ref={heading} tabIndex={-1}>Thank you for helping shape Unboxed Together</h1>
          <p className="wq-tagline">Your answers help us understand what people are interested in and what support could be useful.</p>
          <p className="wq-paragraph">Leave your details if you&apos;d like us to follow up. They&apos;re optional, but without them we can&apos;t send you personalised follow-up information.</p>
          <div className="join-q__fields">
            <label htmlFor="jq-first-name">First name <span className="wq-help">(optional)</span></label>
            <input id="jq-first-name" className="wq-input" autoComplete="given-name" maxLength={60} value={details.firstName} onChange={(event) => setDetails({ ...details, firstName: event.target.value })} />
            <label htmlFor="jq-email">Email address <span className="wq-help">(optional)</span></label>
            <input id="jq-email" className="wq-input" type="email" autoComplete="email" maxLength={254} value={details.email} onChange={(event) => setDetails({ ...details, email: event.target.value })} />
            <p className="wq-help">If you later join as a member with this email, you can choose to link these answers to your account.</p>
          </div>
          <fieldset className="join-q__permissions">
            <legend className="wq-question-label">How may we contact you?</legend>
            <p className="wq-help">Both are optional and separate. Neither box is needed to register your interest.</p>
            <label className="wq-checkbox"><input type="checkbox" checked={details.project_contact} onChange={(event) => setDetails({ ...details, project_contact: event.target.checked })} /><span>{consentTexts.project_contact}</span></label>
            <label className="wq-checkbox"><input type="checkbox" checked={details.general_marketing} onChange={(event) => setDetails({ ...details, general_marketing: event.target.checked })} /><span>{consentTexts.general_marketing}</span></label>
            <p className="wq-help">If you tick the second box we&apos;ll email you once to confirm it before sending any news. You can change your mind at any time using the link in our emails.</p>
          </fieldset>
          <div className="join-q__honeypot" aria-hidden="true">
            <label htmlFor="jq-website">Leave this empty</label>
            <input id="jq-website" tabIndex={-1} autoComplete="off" value={details.website} onChange={(event) => setDetails({ ...details, website: event.target.value })} />
          </div>
          <p className="wq-help">We use your answers to plan Unboxed Together and, only if you ask, to contact you. Read our <Link href="/privacy#registering-interest">Privacy Notice</Link>.</p>
          {status.error && <p className="onboarding-error" role="alert">{status.error}</p>}
          <div className="onboarding-actions wq-actions">
            <button type="button" className="member-button secondary" disabled={status.saving} onClick={() => goTo(step - 1)}>Back</button>
            <button type="submit" className="member-button" disabled={status.saving || !idempotencyKey}>{status.saving ? 'Sending…' : 'Send my answers'}</button>
          </div>
        </form>
      )}
    </section>
  );
}
