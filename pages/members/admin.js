import { useEffect, useState } from 'react';
import Head from 'next/head';
import Layout from '../../components/Layout';
import SEO from '../../components/SEO';
import { useMemberData } from '../../utils/use-member-data';
import { questionnaireSections } from '../../utils/welcome-questionnaire.mjs';

const formatDate = (value) => (value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

function displayValue(field, value, answers) {
  if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) return null;
  if (field.type === 'checkbox') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    const other = field.otherKey && answers[field.otherKey] ? ` (${answers[field.otherKey]})` : '';
    return value.join(', ') + other;
  }
  return [field.prefix, value, field.suffix].filter(Boolean).join(' ');
}

function SectionAnswers({ section, answers }) {
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

function MemberDetail({ id, onClose }) {
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

  if (state.loading) return <p className="auth-loading">Loading answers…</p>;
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
        <ul className="admin-history">{consentHistory.map((event) => <li key={`${event.recorded_at}-${event.consent_type}`}>{formatDate(event.recorded_at)} — {event.consent_type === 'health_information' ? 'Health information (pages 2 to 4)' : 'Marketing emails'} {event.action}{event.recorded_name ? ` · ${event.recorded_name}` : ''}</li>)}</ul>
      ) : <p>No consent changes recorded.</p>}
    </section>
  );
}

function MemberMessages() {
  const [state, setState] = useState({ loading: true, error: '', messages: [] });
  useEffect(() => {
    fetch('/api/admin/messages')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Messages could not be loaded.');
        setState({ loading: false, error: '', messages: data.messages });
      })
      .catch((error) => setState({ loading: false, error: error.message, messages: [] }));
  }, []);
  const markRead = async (id) => {
    const response = await fetch('/api/admin/messages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    if (response.ok) setState((current) => ({ ...current, messages: current.messages.map((item) => (item.id === id ? { ...item, status: 'read' } : item)) }));
  };

  if (state.loading) return <p className="auth-loading">Loading messages…</p>;
  if (state.error) return <p className="onboarding-error" role="alert">{state.error}</p>;
  return (
    <section className="profile-panel">
      <h2>{state.messages.filter((item) => item.status === 'new').length} new {state.messages.length === 1 ? 'message' : 'messages'}</h2>
      {state.messages.length === 0 && <p>No messages yet.</p>}
      <ul className="admin-messages">
        {state.messages.map((item) => (
          <li key={item.id} className={item.status === 'new' ? 'is-new' : ''}>
            <div><strong>{item.display_name}</strong> · {item.topic} · {formatDate(item.created_at)}</div>
            <p>{item.message}</p>
            <div>Reply to <a href={`mailto:${item.reply_email}`}>{item.reply_email}</a>{item.status === 'new' && <button className="text-button" type="button" onClick={() => markRead(item.id)}>Mark as read</button>}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function AdminQuestionnaires() {
  const { data, loading, error } = useMemberData('/api/admin/questionnaires');
  const [selected, setSelected] = useState('');
  const [tab, setTab] = useState('questionnaires');

  return (
    <Layout>
      <SEO title="Team area | Unboxed Together" description="Restricted member questionnaire access." path="/members/admin" />
      <Head><meta name="robots" content="noindex, nofollow" /></Head>
      <div className="member-page profile-page">
        <header className="member-hero compact"><p className="member-kicker">Team only</p><h1>Team area</h1><p>Read-only and confidential. Every view is recorded. Do not copy answers into email.</p></header>
        <nav className="dashboard-nav" aria-label="Team area sections">
          <button type="button" className={tab === 'questionnaires' ? 'is-active' : ''} onClick={() => setTab('questionnaires')}>Questionnaires</button>
          <button type="button" className={tab === 'messages' ? 'is-active' : ''} onClick={() => setTab('messages')}>Messages</button>
        </nav>
        {tab === 'messages' && !error && <MemberMessages />}
        {error && <p className="onboarding-error" role="alert">{error}</p>}
        {tab === 'questionnaires' && loading && !error && <p className="auth-loading">Loading questionnaires…</p>}
        {tab === 'questionnaires' && data && (selected ? <MemberDetail id={selected} onClose={() => setSelected('')} /> : (
          <section className="profile-panel">
            <h2>{data.members.length} {data.members.length === 1 ? 'member' : 'members'}</h2>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Name</th><th>Email</th><th>Page 1</th><th>Consent</th><th>Pages saved</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {data.members.map((member) => (
                    <tr key={member.id}>
                      <td>{member.display_name}</td>
                      <td>{member.email}</td>
                      <td>{formatDate(member.completed_at)}</td>
                      <td>{member.consent_given_at ? formatDate(member.consent_given_at) : 'Not given'}</td>
                      <td>{[2, 3, 4].filter((number) => member[`section_${number}_saved_at`]).join(', ') || '—'}</td>
                      <td><button className="text-button" type="button" onClick={() => setSelected(member.id)}>View answers</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </Layout>
  );
}
