import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import SEO from '../../components/SEO';
import BrandLoader from '../../components/BrandLoader';
import SubmissionVersions, { submissionStatus } from '../../components/members/SubmissionView';
import { useMemberData } from '../../utils/use-member-data';
import { submissionTitle } from '../../utils/progress-checkin.mjs';

const seo = <SEO title="My forms and assessments | Unboxed Together" description="Your private form history." path="/members/forms" />;
const formatDate = (value) => new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

function Detail({ id, onClose }) {
  const [state, setState] = useState({ loading: true, error: '', detail: null });
  useEffect(() => {
    fetch(`/api/forms?id=${encodeURIComponent(id)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'That record could not be loaded.');
        setState({ loading: false, error: '', detail: data });
      })
      .catch((error) => setState({ loading: false, error: error.message, detail: null }));
  }, [id]);
  if (state.loading) return <BrandLoader label="Loading your answers…" />;
  if (state.error) return <section className="profile-panel"><p className="onboarding-error" role="alert">{state.error}</p><button className="text-button" type="button" onClick={onClose}>← Back to the list</button></section>;
  return <SubmissionVersions detail={state.detail} onClose={onClose} />;
}

export default function MyForms() {
  const router = useRouter();
  const { data, loading, error } = useMemberData('/api/forms');
  const selected = typeof router.query.id === 'string' ? router.query.id : '';
  const open = (id) => router.push(id ? `/members/forms?id=${encodeURIComponent(id)}` : '/members/forms', undefined, { shallow: true });

  let body;
  if (error) body = <p className="onboarding-error" role="alert">{error}</p>;
  else if (loading || !data) body = <BrandLoader label="Loading your forms…" />;
  else if (selected) body = <Detail key={selected} id={selected} onClose={() => open('')} />;
  else {
    body = (
      <>
        <section className="profile-panel">
          <h2>{data.submissions.length} saved {data.submissions.length === 1 ? 'record' : 'records'}</h2>
          <p>Every form you submit is kept. Updating an answer adds a new version; earlier versions stay here unchanged.</p>
          {data.submissions.length ? (
            <ul className="form-history">
              {data.submissions.map((row) => (
                <li key={row.id}>
                  <button type="button" onClick={() => open(row.id)}>
                    <strong>{submissionTitle(row)}</strong>
                    <span>{row.entry_date ? `Dated ${new Date(`${row.entry_date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })} · saved ` : ''}{formatDate(row.submitted_at)}</span>
                    <span className={`form-status is-${row.status}`}>{submissionStatus(row)}</span>
                    {row.overall_score !== null && <span className="form-score">{Math.round(row.overall_score)}/100</span>}
                  </button>
                </li>
              ))}
            </ul>
          ) : <p>No forms saved yet.</p>}
        </section>
        {data.messages.length > 0 && (
          <section className="profile-panel">
            <h2>Messages you sent</h2>
            <ul className="form-history is-static">
              {data.messages.map((message) => <li key={message.id}><div><strong>{message.topic}</strong><span>{formatDate(message.created_at)}</span><span className="form-status">{message.status === 'read' ? 'Read by the team' : 'Sent'}</span></div></li>)}
            </ul>
          </section>
        )}
        <section className="profile-panel">
          <h2>Download my records</h2>
          <p>Downloads are created for you when you ask and are not stored anywhere. Keep them somewhere safe: they contain your health and wellbeing answers.</p>
          <div className="card-actions">
            <a className="member-button" href="/api/forms/export?format=pdf">Progress and assessment report (PDF)</a>
            <a className="member-button secondary" href="/api/forms/export?format=json">All my data (JSON)</a>
          </div>
        </section>
      </>
    );
  }

  return (
    <Layout>
      {seo}
      <Head><meta name="robots" content="noindex, nofollow" /></Head>
      <div className="member-page profile-page">
        <header className="member-hero compact"><p className="member-kicker">Private to you</p><h1>My forms &amp; assessments</h1><p>Everything you have submitted, with the date and status. Open any record to read your original answers.</p></header>
        <nav className="dashboard-nav" aria-label="Member sections">
          <Link href="/members">Dashboard</Link>
          <Link href="/members/progress">My progress</Link>
          <Link href="/members/forms" className="is-active" aria-current="page">My forms &amp; assessments</Link>
        </nav>
        {body}
      </div>
    </Layout>
  );
}
