import { useEffect, useState } from 'react';
import BrandLoader from '../BrandLoader';
import { questionnaireSections } from '../../utils/welcome-questionnaire.mjs';
import { SectionAnswers } from './SubmissionView';

const formatDate = (value) => (value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

const consentLabels = { health_information: 'Health information (pages 2 to 4)', marketing_email: 'Marketing emails', progress_tracking: 'Progress tracking' };

// A member's welcome questionnaire answers. Opening it is a separate,
// logged request; pages 2 to 4 only exist where the member gave explicit
// consent for health information.
export default function MemberDetail({ id, onClose }) {
  const [state, setState] = useState({ loading: true, error: '', member: null });
  useEffect(() => {
    fetch(`/api/admin/questionnaires?member=${encodeURIComponent(id)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'This member could not be loaded.');
        setState({ loading: false, error: '', member: data.member });
      })
      .catch((error) => setState({ loading: false, error: error.message, member: null }));
  }, [id]);

  if (state.loading) return <BrandLoader label="Loading answers…" />;
  if (state.error) return <p className="onboarding-error" role="alert">{state.error}</p>;
  const { profile, welcome, health, consentHistory } = state.member;

  return (
    <section className="profile-panel admin-detail">
      <button className="text-button" type="button" onClick={onClose}>← Back to all members</button>
      <h2>{profile.display_name}</h2>
      <p>Aged 18 or over confirmed {formatDate(welcome?.adult_confirmed_at)} · Marketing emails: {profile.marketing_consent ? `yes (since ${formatDate(profile.marketing_consented_at)})` : 'no'}</p>
      <h3>1. {questionnaireSections[0].title}</h3>
      {welcome ? <SectionAnswers section={questionnaireSections[0]} answers={welcome.answers} /> : <p>Not completed.</p>}
      {health ? (
        <>
          <p className="admin-consent">Explicit consent for pages 2 to 4 given by {health.consent_name} on {formatDate(health.consent_given_at)}.</p>
          {questionnaireSections.slice(1).map((section) => (
            <div key={section.number}>
              <h3>{section.number}. {section.title}</h3>
              <p className="admin-saved">Saved {formatDate(health[`section_${section.number}_saved_at`])}</p>
              <SectionAnswers section={section} answers={health.answers} />
            </div>
          ))}
        </>
      ) : <p className="admin-consent">No consent for pages 2 to 4. No health or wellbeing information is held.</p>}
      <h3>Consent history</h3>
      {consentHistory.length ? (
        <ul className="admin-history">{consentHistory.map((event) => <li key={`${event.recorded_at}-${event.consent_type}`}>{formatDate(event.recorded_at)} — {consentLabels[event.consent_type] || event.consent_type} {event.action}{event.recorded_name ? ` · ${event.recorded_name}` : ''}</li>)}</ul>
      ) : <p>No consent changes recorded.</p>}
    </section>
  );
}
