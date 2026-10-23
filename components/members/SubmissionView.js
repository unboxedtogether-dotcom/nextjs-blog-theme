import { useState } from 'react';
import { questionnaireSections } from '../../utils/welcome-questionnaire.mjs';
import { categoryByKey, scoreCategories, submissionTitle } from '../../utils/progress-checkin.mjs';
import { AnswerRows } from '../progress/ProgressOverview';

const formatDate = (value) => (value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const welcomeSection = { welcome_details: 1, welcome_food: 2, welcome_everyday: 3, welcome_health: 4 };

function displayValue(field, value, answers) {
  if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) return null;
  if (field.type === 'checkbox') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    const other = field.otherKey && answers[field.otherKey] ? ` (${answers[field.otherKey]})` : '';
    return value.join(', ') + other;
  }
  return [field.prefix, value, field.suffix].filter(Boolean).join(' ');
}

export function SectionAnswers({ section, answers }) {
  const rows = section.blocks.filter((block) => block.kind === 'question').flatMap((question) => question.fields
    .filter((field) => !field.profileField)
    .map((field) => ({ key: field.key, question, label: field.label || '', value: displayValue(field, answers[field.key], answers) })));
  return (
    <dl className="admin-answers">
      {rows.map((row) => (
        <div key={row.key}>
          <dt>{row.question.number ? `${row.question.number}. ` : ''}{row.question.label || ''}{row.label ? ` — ${row.label}` : ''}</dt>
          <dd>{row.value ?? <span className="admin-empty">Not answered</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

export const submissionStatus = (row) => {
  if (row.source === 'backfill') return 'Recorded from earlier answers';
  if (row.status === 'incomplete') return 'Incomplete (not scored)';
  return row.revision_number ? `Correction ${row.revision_number}` : 'Submitted';
};

// All versions of one record. The original is never changed; corrections and
// later saves are shown alongside it.
export default function SubmissionVersions({ detail, onClose }) {
  const [selected, setSelected] = useState(() => detail.versions.find((row) => row.id === detail.selectedId)?.id || detail.versions[0].id);
  const version = detail.versions.find((row) => row.id === selected);
  const section = questionnaireSections.find((item) => item.number === welcomeSection[version.form_type]);

  return (
    <section className="profile-panel submission-view">
      {onClose && <button className="text-button" type="button" onClick={onClose}>← Back to the list</button>}
      <h2>{submissionTitle(version)}</h2>
      {detail.versions.length > 1 && (
        <div className="review-filters" role="group" aria-label="Versions">
          {detail.versions.map((row) => (
            <button key={row.id} type="button" className={row.id === selected ? 'is-active' : ''} aria-pressed={row.id === selected} onClick={() => setSelected(row.id)}>
              {row.revision_number === 0 ? 'Original' : `Version ${row.revision_number + 1}`} · {new Date(row.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </button>
          ))}
        </div>
      )}
      <dl className="submission-meta">
        {version.entry_date && <div><dt>Dated</dt><dd>{new Date(`${version.entry_date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</dd></div>}
        <div><dt>Submitted</dt><dd>{formatDate(version.submitted_at)}</dd></div>
        <div><dt>Status</dt><dd>{submissionStatus(version)}</dd></div>
        <div><dt>Form version</dt><dd>{version.form_version}</dd></div>
        {version.week_start && <div><dt>Reporting week starting</dt><dd>{new Date(`${version.week_start}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</dd></div>}
        {version.revision_reason && <div><dt>Reason for change</dt><dd>{version.revision_reason}</dd></div>}
        {version.scoring_version && <div><dt>Scoring rules</dt><dd>{version.scoring_version}</dd></div>}
      </dl>
      {version.source === 'backfill' && <p className="dashboard-note">These answers were copied into your permanent history when it was introduced. Earlier changes made before then were not kept.</p>}
      {version.score_id && (
        <div className="submission-scores">
          <div><span>Overall</span><strong>{version.overall_score === null ? 'Not calculated' : `${Math.round(version.overall_score)}/100`}</strong></div>
          {scoreCategories.map((category) => (
            <div key={category.key}><span>{categoryByKey[category.key].fullLabel}</span><strong>{version.categories?.[category.key]?.score === null || version.categories?.[category.key] === undefined ? 'Not enough answers' : `${Math.round(version.categories[category.key].score)}/100`}</strong></div>
          ))}
        </div>
      )}
      {section ? <SectionAnswers section={section} answers={version.answers} /> : <AnswerRows answers={version.answers} />}
    </section>
  );
}
