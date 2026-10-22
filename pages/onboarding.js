import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import SEO from '../components/SEO';
import BrandLogo from '../components/BrandLogo';
import { useMemberData } from '../utils/use-member-data';
import { emptyAnswers, healthSectionNumbers, privacyContactEmail, privacyNoticePath, questionnaireSections, sectionFields } from '../utils/welcome-questionnaire.mjs';
import BrandLoader from '../components/BrandLoader';

const pageTitle = 'Welcome questionnaire | Unboxed Together';
const pageDescription = 'Tell Unboxed Together about you, what matters to you and what would make everyday life a little easier.';
const today = () => new Date().toLocaleDateString('en-CA');
const formatDate = (value) => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export default function Onboarding() {
  const { data, loading, error } = useMemberData('/api/questionnaire');

  if (error || loading || !data) {
    return (
      <main className="onboarding-page" id="main-content">
        <SEO title={pageTitle} description={pageDescription} path="/onboarding" />
        {error ? <p className="onboarding-error" role="alert">{error}</p> : <BrandLoader label="Loading your questionnaire…" />}
      </main>
    );
  }

  return <QuestionnaireForm initial={data} />;
}

function startingStep(initial, requested) {
  const page = Number(requested);
  if (page === 1 || (page === 2 && initial.welcome) || (page > 2 && page <= 4 && initial.health)) return page - 1;
  if (!initial.welcome) return 0;
  if (!initial.health) return 1;
  if (!initial.health.sectionSavedAt[3]) return 2;
  if (!initial.health.sectionSavedAt[4]) return 3;
  return 0;
}

function QuestionnaireForm({ initial }) {
  const router = useRouter();
  const [answers, setAnswers] = useState(() => {
    const merged = {
      ...emptyAnswers(),
      preferredName: initial.profile.displayName,
      email: initial.accountEmail,
      ...(initial.welcome?.answers || {}),
      ...(initial.health?.answers || {}),
      marketingConsent: initial.profile.marketingConsent,
    };
    if (!merged.baselineDate) merged.baselineDate = today();
    return merged;
  });
  const [welcomeSaved, setWelcomeSaved] = useState(Boolean(initial.welcome));
  const [savedConsent, setSavedConsent] = useState(initial.health ? { name: initial.health.consentName, date: initial.health.consentGivenAt } : null);
  const [healthConsent, setHealthConsent] = useState(Boolean(initial.health));
  const [step, setStep] = useState(() => startingStep(initial, router.query.page));
  const [status, setStatus] = useState({ saving: false, error: '' });

  const finished = step === questionnaireSections.length;
  const section = questionnaireSections[step];
  const setAnswer = (key, value) => setAnswers((current) => ({ ...current, [key]: value }));
  const goTo = (next) => { setStatus({ saving: false, error: '' }); setStep(next); window.scrollTo({ top: 0 }); };
  const canOpen = (index) => index === 0 || (index === 1 && welcomeSaved) || (index > 1 && Boolean(savedConsent));

  const save = async (after) => {
    if (section.number === 1) {
      if (!answers.preferredName.trim()) return setStatus({ saving: false, error: 'Please enter the name you would like us to use.' });
      if (!answers.email.trim()) return setStatus({ saving: false, error: 'Please enter your email address.' });
      if (!answers.adultConfirmed) return setStatus({ saving: false, error: 'Please confirm you are aged 18 or over to set up an adult membership.' });
    }
    setStatus({ saving: true, error: '' });
    try {
      const response = await fetch('/api/questionnaire', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: section.number, answers, healthConsent }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'We could not save your answers.');
      if (section.number === 1) setWelcomeSaved(true);
      if (section.number === 2) setSavedConsent(healthConsent ? (savedConsent || { name: answers.preferredName, date: new Date().toISOString() }) : null);
      if (section.number === 2 && !healthConsent && savedConsent) {
        const blank = emptyAnswers();
        const healthKeys = healthSectionNumbers.flatMap((number) => sectionFields(number).map((field) => field.key));
        setAnswers((current) => ({ ...current, ...Object.fromEntries(healthKeys.map((key) => [key, blank[key]])), baselineDate: today() }));
      }
      setStatus({ saving: false, error: '' });
      after();
    } catch (error) {
      setStatus({ saving: false, error: error.message });
    }
  };

  const continueLabel = section?.number === 2 && !healthConsent ? (savedConsent ? 'Withdraw consent and continue' : 'Skip pages 2 to 4') : section?.number === 4 ? 'Save my answers' : 'Save and continue';
  const afterContinue = () => goTo(section.number === 2 && !healthConsent ? questionnaireSections.length : step + 1);

  return (
    <main className="onboarding-page" id="main-content">
      <SEO title={pageTitle} description={pageDescription} path="/onboarding" />
      <header className="onboarding-header"><BrandLogo /><span>Welcome questionnaire</span></header>
      <nav className="wq-steps" aria-label="Questionnaire pages">
        {questionnaireSections.map((item, index) => (
          <button key={item.number} type="button" className={`wq-step${index === step ? ' is-current' : ''}`} aria-current={index === step ? 'step' : undefined} disabled={!canOpen(index)} onClick={() => goTo(index)}>
            <span>{item.number}</span>{item.title}
          </button>
        ))}
      </nav>
      <section className="onboarding-card wq-card">
        {finished ? (
          <div className="onboarding-finish">
            <p className="onboarding-count">Answers saved</p>
            <h1>Thank you.</h1>
            <p>Your answers are saved to your account. You can come back to review or update them at any time from your dashboard or profile.</p>
            <div className="finish-actions"><Link className="member-button" href="/members">Go to my dashboard</Link><button className="member-button secondary" type="button" onClick={() => goTo(0)}>Review my answers</button></div>
          </div>
        ) : (
          <form onSubmit={(event) => { event.preventDefault(); save(afterContinue); }} noValidate>
            <p className="onboarding-count">Page {section.number} of {questionnaireSections.length}</p>
            <h1>{section.title}</h1>
            {section.tagline && <p className="wq-tagline">{section.tagline}</p>}
            {section.number > 2 && !savedConsent ? (
              <p className="wq-paragraph">{questionnaireSections[1].blocks.find((block) => block.kind === 'consent').skipText}</p>
            ) : (
              <SectionBlocks section={section} answers={answers} setAnswer={setAnswer} healthConsent={healthConsent} setHealthConsent={setHealthConsent} savedConsent={savedConsent} />
            )}
            {status.error && <p className="onboarding-error" role="alert">{status.error}</p>}
            <div className="onboarding-actions wq-actions">
              {step > 0 ? <button type="button" className="member-button secondary" onClick={() => goTo(step - 1)}>Back</button> : <span />}
              <div>
                {welcomeSaved && <button type="button" className="text-button" disabled={status.saving} onClick={() => save(() => router.push('/members'))}>Save and finish later</button>}
                <button type="submit" className="member-button" disabled={status.saving}>{status.saving ? 'Saving…' : continueLabel}</button>
              </div>
            </div>
          </form>
        )}
      </section>
      <p className="onboarding-privacy">Your answers stay connected to your account, are never emailed and are not sent to analytics. Read our <Link href={privacyNoticePath}>Privacy Policy</Link>.</p>
    </main>
  );
}

function SectionBlocks({ section, answers, setAnswer, healthConsent, setHealthConsent, savedConsent }) {
  const consentIndex = section.blocks.findIndex((block) => block.kind === 'consent');
  const visibleBlocks = consentIndex >= 0 && !healthConsent ? section.blocks.slice(0, consentIndex + 1) : section.blocks;

  return visibleBlocks.map((block, index) => {
    const id = `s${section.number}-b${index}`;
    if (block.kind === 'heading') return <h2 key={id} className="wq-heading">{block.text}</h2>;
    if (block.kind === 'paragraph') return <p key={id} className="wq-paragraph">{block.text}</p>;
    if (block.kind === 'note') return <p key={id} className="wq-note">{block.text}</p>;
    if (block.kind === 'privacy') {
      return (
        <div key={id} className="wq-privacy">
          <p>Privacy notice: <Link href={privacyNoticePath}>unboxedtogether.com{privacyNoticePath}</Link></p>
          <p>Privacy contact: <a href={`mailto:${privacyContactEmail}`}>{privacyContactEmail}</a></p>
        </div>
      );
    }
    if (block.kind === 'consent') {
      return (
        <div key={id} className="wq-consent">
          <h2 className="wq-heading">{block.heading}</h2>
          <label className="wq-checkbox"><input type="checkbox" checked={healthConsent} onChange={(event) => setHealthConsent(event.target.checked)} /><span>{block.label}</span></label>
          <dl className="wq-consent-record">
            <div><dt>Name:</dt><dd>{savedConsent?.name || answers.preferredName}</dd></div>
            <div><dt>Date:</dt><dd>{formatDate(savedConsent?.date || new Date())}</dd></div>
          </dl>
          <p className="wq-paragraph">{block.skipText}</p>
          {savedConsent && !healthConsent && <p className="wq-warning" role="alert">Continuing with this box unticked withdraws your consent and permanently deletes your answers on pages 2 to 4.</p>}
        </div>
      );
    }
    return <Question key={id} id={id} question={block} answers={answers} setAnswer={setAnswer} />;
  });
}

function Question({ id, question, answers, setAnswer }) {
  const labelId = `${id}-label`;
  return (
    <fieldset className="wq-question" aria-labelledby={question.label ? labelId : undefined}>
      {question.label && (
        <legend id={labelId} className="wq-question-label">
          {question.number && <span className="wq-number">{question.number}.</span>}{question.label}{question.required && <span className="wq-required" aria-hidden="true"> *</span>}
        </legend>
      )}
      {question.help && <p className="wq-help">{question.help}</p>}
      <div className="wq-fields">
        {question.fields.map((field) => (
          <Field key={field.key} field={field} question={question} labelId={question.label ? labelId : undefined} value={answers[field.key]} answers={answers} setAnswer={setAnswer} />
        ))}
      </div>
    </fieldset>
  );
}

function Field({ field, question, labelId, value, answers, setAnswer }) {
  const inputId = `wq-${field.key}`;
  const labelledBy = field.label ? undefined : labelId;

  if (field.type === 'checkbox') {
    return (
      <label className="wq-checkbox">
        <input id={inputId} type="checkbox" checked={value === true} required={field.required} onChange={(event) => setAnswer(field.key, event.target.checked)} />
        <span>{!question.label && question.number && <span className="wq-number">{question.number}.</span>}{field.label}{field.required && <span className="wq-required" aria-hidden="true"> *</span>}</span>
      </label>
    );
  }

  if (field.type === 'multi' || field.type === 'single') {
    const selected = field.type === 'multi' ? value || [] : value;
    const choose = (option) => {
      if (field.type === 'single') return setAnswer(field.key, selected === option ? '' : option);
      return setAnswer(field.key, selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option]);
    };
    return (
      <div className="wq-field">
        <div className="wq-choices" role="group" aria-labelledby={labelId}>
          {field.options.map((option) => {
            const isSelected = field.type === 'multi' ? selected.includes(option) : selected === option;
            return <button key={option} type="button" className={`onboarding-choice${isSelected ? ' is-selected' : ''}`} aria-pressed={isSelected} onClick={() => choose(option)}>{option}</button>;
          })}
        </div>
        {field.otherKey && selected.includes('Other') && (
          <input className="wq-input" aria-label="Other" value={answers[field.otherKey] || ''} maxLength={300} onChange={(event) => setAnswer(field.otherKey, event.target.value)} />
        )}
      </div>
    );
  }

  if (field.type === 'scale') {
    return (
      <div className="wq-scale" role="group" aria-label={field.label}>
        <div className="wq-scale-text"><strong>{field.label}</strong><span>{field.note}</span></div>
        <div className="wq-scale-buttons">
          {[1, 2, 3, 4, 5].map((number) => (
            <button key={number} type="button" className={`onboarding-choice${value === number ? ' is-selected' : ''}`} aria-pressed={value === number} onClick={() => setAnswer(field.key, value === number ? null : number)}>{number}</button>
          ))}
        </div>
      </div>
    );
  }

  const shared = {
    id: inputId,
    className: field.type === 'textarea' ? 'wq-input wq-textarea' : 'wq-input',
    'aria-labelledby': labelledBy,
    value: value ?? '',
    required: field.required,
    onChange: (event) => setAnswer(field.key, ['integer', 'decimal'].includes(field.type) && event.target.value === '' ? null : event.target.value),
  };
  const typeProps = {
    text: { type: 'text', maxLength: 300, autoComplete: field.autoComplete },
    email: { type: 'email', maxLength: 254, autoComplete: field.autoComplete },
    tel: { type: 'tel', maxLength: 40, autoComplete: field.autoComplete },
    integer: { type: 'number', inputMode: 'numeric', min: field.min, max: field.max, step: 1 },
    decimal: { type: 'number', inputMode: 'decimal', min: field.min, max: field.max, step: 0.5 },
    time: { type: 'time' },
    date: { type: 'date' },
  }[field.type];

  return (
    <div className={`wq-field${field.inline ? ' wq-inline' : ''}`}>
      {field.intro && <p className="wq-help">{field.intro}</p>}
      {field.label && <label htmlFor={inputId}>{field.label}</label>}
      {field.prefix && <span>{field.prefix}</span>}
      {field.type === 'textarea' ? <textarea {...shared} rows={4} maxLength={3000} /> : <input {...shared} {...typeProps} />}
      {field.suffix && <span>{field.suffix}</span>}
      {field.help && <p className="wq-help">{field.help}</p>}
    </div>
  );
}
