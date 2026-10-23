import { useRef, useState } from 'react';
import { missingRequired, scoreCategories, unscoredItems } from '../../utils/progress-checkin.mjs';
import { formatDay } from './ProgressOverview';

const steps = [...scoreCategories.map((category) => ({ key: category.key, title: category.fullLabel, intro: category.intro, items: category.items })), { key: 'week', title: 'About your week', intro: 'Optional and not scored.', items: unscoredItems }];
const formatTime = (value) => new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

function Question({ item, value, onChange }) {
  const name = `q-${item.key}`;
  const answered = value !== null && value !== undefined && value !== '' && !(Array.isArray(value) && !value.length);
  if (item.type === 'text') {
    return (
      <div className="ci-question">
        <label className="ci-label" htmlFor={name}>{item.label}</label>
        {item.help && <p className="ci-help">{item.help}</p>}
        <textarea id={name} className="wq-input wq-textarea" maxLength={item.maxLength} value={value || ''} onChange={(event) => onChange(event.target.value)} />
      </div>
    );
  }
  if (item.type === 'multi') {
    return (
      <fieldset className="ci-question">
        <legend className="ci-label">{item.label}</legend>
        {item.help && <p className="ci-help">{item.help}</p>}
        <div className="ci-options is-multi">
          {item.options.map((option) => {
            const checked = (value || []).includes(option.value);
            return (
              <label key={option.value} className={`ci-option${checked ? ' is-selected' : ''}`}>
                <input type="checkbox" checked={checked} onChange={() => onChange(checked ? value.filter((entry) => entry !== option.value) : [...(value || []), option.value])} />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }
  return (
    <fieldset className="ci-question">
      <legend className="ci-label">{item.label}{item.required ? '' : <span className="ci-optional"> (optional)</span>}</legend>
      {item.help && <p className="ci-help">{item.help}</p>}
      <div className={`ci-options is-${item.type}`}>
        {item.options.map((option) => (
          <label key={option.value} className={`ci-option${value === option.value ? ' is-selected' : ''}`}>
            <input type="radio" name={name} checked={value === option.value} onChange={() => onChange(option.value)} />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {item.type === 'scale' && <div className="ci-scale-ends" aria-hidden="true"><span>1 = {item.low}</span><span>5 = {item.high}</span></div>}
      {answered && <button type="button" className="ci-clear" onClick={() => onChange(null)}>Clear answer</button>}
    </fieldset>
  );
}

// Baseline (Week 0) and weekly check-in share these exact questions so the
// scores can be compared. Scores are calculated on the server after saving.
// `dateRange` ({ min, max, initial }) shows the "date of this check-in" field.
export default function CheckInForm({ formType, initialAnswers = {}, draftSavedAt = null, revisionOf = null, revisionReasons = [], dateRange = null, onSaved, onCancel }) {
  const [entryDate, setEntryDate] = useState(() => dateRange?.initial || dateRange?.max || '');
  const [answers, setAnswers] = useState(() => ({ weekContext: [], personalNote: '', ...initialAnswers }));
  const [step, setStep] = useState(0);
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState({ saving: false, error: '', draftSavedAt, confirmIncomplete: false });
  // One key per attempt: retries and double clicks reuse it, so the server saves once.
  const idempotencyKey = useRef(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '');
  const current = steps[step];
  const last = step === steps.length - 1;
  const setAnswer = (key, value) => setAnswers((previous) => ({ ...previous, [key]: value }));

  const saveDraft = async () => {
    if (revisionOf) return null;
    const response = await fetch('/api/progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'draft', formType, answers }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Your draft could not be saved.');
    setStatus((previous) => ({ ...previous, draftSavedAt: data.draftSavedAt }));
    return data;
  };

  const goTo = (next) => {
    setStep(next);
    setStatus((previous) => ({ ...previous, error: '', confirmIncomplete: false }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    saveDraft().catch(() => {});
  };

  const submit = async (allowIncomplete = false) => {
    if (revisionOf && !reason) return setStatus((previous) => ({ ...previous, error: 'Please choose why you are correcting this check-in.' }));
    if (dateRange && (!entryDate || entryDate < dateRange.min || entryDate > dateRange.max)) {
      setStep(0);
      return setStatus((previous) => ({ ...previous, error: `Please choose a date between ${formatDay(dateRange.min)} and ${formatDay(dateRange.max)}.` }));
    }
    if (!allowIncomplete && missingRequired(answers).length) return setStatus((previous) => ({ ...previous, error: '', confirmIncomplete: true }));
    setStatus((previous) => ({ ...previous, saving: true, error: '', confirmIncomplete: false }));
    try {
      const response = await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', formType, answers, entryDate: dateRange ? entryDate : undefined, idempotencyKey: idempotencyKey.current, revisionOf, revisionReason: reason || undefined }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Your check-in could not be saved. Please try again.');
      onSaved(data);
    } catch (error) {
      // The same idempotency key is kept, so trying again cannot create a duplicate.
      setStatus((previous) => ({ ...previous, saving: false, error: error.message }));
    }
  };

  const missing = missingRequired(answers);
  const missingCategories = [...new Set(missing.map((item) => scoreCategories.find((category) => category.key === item.category).fullLabel))];

  return (
    <form className="checkin-form" onSubmit={(event) => { event.preventDefault(); if (last) submit(); else goTo(step + 1); }} noValidate>
      <div className="ci-progress" aria-hidden="true">{steps.map((item, index) => <span key={item.key} className={index <= step ? 'is-done' : ''} />)}</div>
      <p className="onboarding-count">Step {step + 1} of {steps.length} · Think about the {dateRange ? '7 days up to the date you choose' : 'past 7 days'}</p>
      <h2 className="ci-title">{current.title}</h2>
      {step === 0 && dateRange && (
        <div className="ci-question ci-date">
          <label className="ci-label" htmlFor="ci-entry-date">{formType === 'baseline_wellbeing' ? 'Date of your baseline' : 'Date of this check-in'}</label>
          <p className="ci-help">{formType === 'baseline_wellbeing'
            ? 'The day your starting point describes. Weekly check-ins follow from the week after.'
            : 'Choose the day these answers are for. Today is filled in; pick an earlier date to add a week you missed. Each Monday-to-Sunday week has one check-in.'}</p>
          <input id="ci-entry-date" className="wq-input" type="date" required min={dateRange.min} max={dateRange.max} value={entryDate} onChange={(event) => setEntryDate(event.target.value)} />
        </div>
      )}
      {current.intro && <p className="ci-intro">{current.intro}</p>}
      {current.items.map((item) => <Question key={item.key} item={item} value={answers[item.key]} onChange={(value) => setAnswer(item.key, value)} />)}

      {last && revisionOf && (
        <fieldset className="ci-question">
          <legend className="ci-label">Why are you correcting this check-in?</legend>
          <p className="ci-help">Your original answers stay on record. The correction is saved alongside them.</p>
          <div className="ci-options is-choice">
            {revisionReasons.map((option) => (
              <label key={option} className={`ci-option${reason === option ? ' is-selected' : ''}`}><input type="radio" name="reason" checked={reason === option} onChange={() => setReason(option)} /><span>{option}</span></label>
            ))}
          </div>
        </fieldset>
      )}

      {status.confirmIncomplete && (
        <div className="ci-warning" role="alert">
          <p><strong>Some required questions are blank</strong> ({missingCategories.join(', ')}).</p>
          <p>You can go back and answer them, or save anyway. This week will be marked as incomplete: it will show the category scores you did answer, but no overall score, and it will not be used in comparisons. Blank answers never count as zero.</p>
          <div className="card-actions">
            <button type="button" className="member-button" onClick={() => goTo(steps.findIndex((item) => item.key === missing[0].category))}>Go back and answer</button>
            <button type="button" className="member-button secondary" disabled={status.saving} onClick={() => submit(true)}>Save as incomplete</button>
          </div>
        </div>
      )}
      {status.error && <p className="onboarding-error" role="alert">{status.error}</p>}

      <div className="ci-actions">
        {step > 0 ? <button type="button" className="member-button secondary" onClick={() => goTo(step - 1)}>Back</button> : (onCancel ? <button type="button" className="member-button secondary" onClick={onCancel}>Cancel</button> : <span />)}
        <button type="submit" className="member-button" disabled={status.saving}>{status.saving ? 'Saving…' : last ? (revisionOf ? 'Save correction' : 'Save my check-in') : 'Next'}</button>
      </div>
      {!revisionOf && (
        <div className="ci-draft">
          <button type="button" className="text-button" onClick={() => saveDraft().then(() => { window.location.href = '/members/progress'; }).catch((error) => setStatus((previous) => ({ ...previous, error: error.message })))}>Save and finish later</button>
          {status.draftSavedAt && <span>Draft saved at {formatTime(status.draftSavedAt)}</span>}
        </div>
      )}
    </form>
  );
}
