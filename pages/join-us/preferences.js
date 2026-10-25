import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Layout from '../../components/Layout';
import SEO from '../../components/SEO';
import BrandLoader from '../../components/BrandLoader';

const post = async (token, action, extra = {}) => {
  const response = await fetch('/api/prospect/preferences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, action, ...extra }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Your preferences could not be updated.');
  return data;
};

// Reached from the private link in our emails. The token sits in the URL
// fragment, which browsers never send to the server or to other sites.
export default function JoinPreferences() {
  const [token, setToken] = useState('');
  const [state, setState] = useState({ loading: true, error: '', data: null, notice: '' });
  const [confirmErase, setConfirmErase] = useState(false);

  useEffect(() => {
    const found = new URLSearchParams(window.location.hash.slice(1)).get('token') || '';
    // Removes the token from the address bar and history.
    window.history.replaceState(null, '', window.location.pathname);
    setToken(found);
    if (!found) return setState({ loading: false, error: 'This page needs the private link from one of our emails.', data: null, notice: '' });
    post(found, 'load')
      .then((data) => setState({ loading: false, error: '', data, notice: '' }))
      .catch((error) => setState({ loading: false, error: error.message, data: null, notice: '' }));
  }, []);

  const run = async (action, notice, extra) => {
    try {
      const data = await post(token, action, extra);
      setState({ loading: false, error: '', data, notice });
    } catch (error) {
      setState((current) => ({ ...current, notice: '', error: error.message }));
    }
  };

  const permissions = state.data?.permissions;
  return (
    <Layout>
      <SEO title="Email preferences | Unboxed Together" description="Manage what Unboxed Together contacts you about." path="/join-us/preferences" />
      <Head><meta name="robots" content="noindex, nofollow" /><meta name="referrer" content="no-referrer" /></Head>
      <div className="member-page profile-page">
        <header className="member-hero compact"><p className="member-kicker">Your choices</p><h1>Email preferences</h1><p>Choose what we may contact you about. Changes take effect straight away.</p></header>
        {state.loading && <BrandLoader label="Loading your preferences…" />}
        {state.error && <p className="onboarding-error" role="alert">{state.error}</p>}
        {state.notice && <p className="form-message is-success" role="status">{state.notice}</p>}
        {state.data?.erased && (
          <section className="profile-panel"><h2>Your answers have been deleted</h2><p>We have deleted your questionnaire answers, contact details and preferences. We keep only a scrambled copy of your email address so it is not contacted again.</p><Link className="member-button" href="/">Go to the homepage</Link></section>
        )}
        {permissions && (
          <section className="profile-panel join-prefs">
            <h2>{state.data.firstName ? `Hi ${state.data.firstName}` : 'Your preferences'}</h2>
            <div className="join-prefs__row">
              <div><strong>Updates about the projects and support you selected</strong><p>{permissions.project_contact ? 'On' : 'Off'}</p></div>
              {permissions.project_contact && <button type="button" className="member-button secondary" onClick={() => run('withdraw', 'You will no longer hear from us about specific projects.', { type: 'project_contact' })}>Stop these emails</button>}
            </div>
            <div className="join-prefs__row">
              <div><strong>General news and promotional emails</strong><p>{permissions.general_marketing === 'verified' ? 'On' : permissions.general_marketing === 'pending' ? 'Waiting for your confirmation' : 'Off'}</p></div>
              {permissions.general_marketing === 'pending' && <button type="button" className="member-button" onClick={() => run('confirm_marketing', 'Thank you. Your subscription to general news is confirmed.')}>Confirm my subscription</button>}
              {permissions.general_marketing === 'verified' && <button type="button" className="member-button secondary" onClick={() => run('withdraw', 'You have been unsubscribed from general news.', { type: 'general_marketing' })}>Unsubscribe</button>}
              {!permissions.general_marketing && <button type="button" className="member-button secondary" onClick={() => run('grant_marketing', 'You are now subscribed to general news.')}>Subscribe</button>}
            </div>
            {permissions.sensitive_answers && (
              <div className="join-prefs__row">
                <div><strong>Your answer about areas you find challenging</strong><p>Stored with your consent</p></div>
                <button type="button" className="member-button secondary" onClick={() => run('withdraw', 'Your answer has been deleted.', { type: 'sensitive_answers' })}>Delete this answer</button>
              </div>
            )}
            <div className="join-prefs__actions">
              {(permissions.project_contact || permissions.general_marketing) && <button type="button" className="text-button" onClick={() => run('unsubscribe_all', 'You have been unsubscribed from all emails.')}>Unsubscribe from everything</button>}
              {!confirmErase
                ? <button type="button" className="text-button danger" onClick={() => setConfirmErase(true)}>Delete all my answers and details</button>
                : (
                  <div className="join-prefs__erase" role="alert">
                    <p>This permanently deletes your questionnaire answers, contact details and preferences.</p>
                    <button type="button" className="member-button" onClick={() => run('erase', '')}>Yes, delete everything</button>
                    <button type="button" className="text-button" onClick={() => setConfirmErase(false)}>Cancel</button>
                  </div>
                )}
            </div>
            <p className="wq-help">Questions? Email <a href="mailto:support@unboxedtogether.com">support@unboxedtogether.com</a> or read our <Link href="/privacy#registering-interest">Privacy Notice</Link>.</p>
          </section>
        )}
      </div>
    </Layout>
  );
}
