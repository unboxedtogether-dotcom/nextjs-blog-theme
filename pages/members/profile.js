import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { signOutCompletely } from '../../utils/sign-out';
import Layout from '../../components/Layout';
import SEO from '../../components/SEO';
import FormMessage from '../../components/auth/FormMessage';
import ProfileEditor, { AvatarControls } from '../../components/members/ProfileEditor';
import SubscriptionCard from '../../components/members/SubscriptionCard';
import { sectionStatus } from '../../components/members/WelcomeFormCard';
import { useMemberData } from '../../utils/use-member-data';
import { privacyContactEmail, privacyNoticePath, questionnaireSections } from '../../utils/welcome-questionnaire.mjs';
import BrandLoader from '../../components/BrandLoader';

const seo = <SEO title="Account settings | Unboxed Together" description="Manage your Unboxed Together profile, preferences and privacy." path="/members/profile" />;
const longDate = (value) => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const settingsLinks = [['#profile', 'Profile'], ['#membership', 'Membership'], ['#communication', 'Communication'], ['#questionnaire', 'Welcome form'], ['#privacy', 'Privacy'], ['#sign-in', 'Sign-in'], ['#delete-account', 'Delete account']];

export default function AccountSettings() {
  const router = useRouter();
  const { data, user, loading, error } = useMemberData();
  const welcomeDone = Boolean(data?.questionnaire?.welcomeCompletedAt);

  useEffect(() => {
    if (!loading && data?.profile && !welcomeDone) router.replace('/onboarding');
  }, [data, loading, router, welcomeDone]);

  if (error || loading || !data?.profile || !welcomeDone) {
    return <Layout>{seo}<div className="member-page">{error ? <p className="onboarding-error" role="alert">{error}</p> : <BrandLoader label="Loading your account…" />}</div></Layout>;
  }

  return <SettingsContent initial={data} email={user?.email || ''} />;
}

function SettingsContent({ initial, email }) {
  const [profile, setProfile] = useState(initial.profile);
  const [about, setAbout] = useState(initial.about);
  const [avatarVersion, setAvatarVersion] = useState(initial.profile.avatar_updated_at);
  const [marketing, setMarketing] = useState(initial.profile.marketing_consent === true);
  const [healthConsentAt, setHealthConsentAt] = useState(initial.questionnaire.healthConsentGivenAt);
  const [status, setStatus] = useState({ area: '', loading: false, error: '', success: '' });
  const [answerAction, setAnswerAction] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const pagesSaved = questionnaireSections.filter((section) => sectionStatus(initial.questionnaire, section.number).done).length;
  const message = (area) => (status.area === area ? <FormMessage error={status.error} success={status.success} /> : null);

  const savePreferences = async (event) => {
    event.preventDefault();
    setStatus({ area: 'communication', loading: true, error: '', success: '' });
    const response = await fetch('/api/member', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preferences: { marketingConsent: marketing } }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setStatus({ area: 'communication', loading: false, error: data.error || 'Your preferences could not be saved.', success: '' });
    return setStatus({ area: 'communication', loading: false, error: '', success: marketing ? 'You will receive Unboxed Together news and offers by email.' : 'You will no longer receive marketing emails. Membership and service messages will continue.' });
  };
  const deleteAnswers = async (scope) => {
    setStatus({ area: 'privacy', loading: true, error: '', success: '' });
    const response = await fetch('/api/questionnaire', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setStatus({ area: 'privacy', loading: false, error: data.error || 'Your answers could not be deleted.', success: '' });
    if (scope === 'all') { window.location.href = '/onboarding'; return undefined; }
    setHealthConsentAt(null); setAnswerAction('');
    return setStatus({ area: 'privacy', loading: false, error: '', success: 'Your consent has been withdrawn and your answers on pages 2 to 4 have been deleted.' });
  };
  const signOut = () => signOutCompletely();
  const deleteAccount = async () => {
    setStatus({ area: 'delete', loading: true, error: '', success: '' });
    const response = await fetch('/api/account', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmation }) });
    if (!response.ok) { const data = await response.json().catch(() => ({})); return setStatus({ area: 'delete', loading: false, error: data.error || 'Account deletion could not be completed.', success: '' }); }
    window.location.href = '/';
    return undefined;
  };

  return (
    <Layout>
      {seo}
      <div className="member-page profile-page">
        <header className="member-hero compact">
          <p className="member-kicker">Your account</p>
          <h1>Account settings</h1>
          <p>Signed in as {email}. <Link className="hero-link" href="/members">← Back to my dashboard</Link></p>
        </header>
        <nav className="dashboard-nav" aria-label="Account settings sections">
          {settingsLinks.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
        </nav>

        <div className="settings-stack">
          <section className="profile-panel" id="profile" aria-labelledby="settings-profile">
            <h2 id="settings-profile">Profile</h2>
            <p>This is how you appear in your member space.</p>
            <AvatarControls name={profile.display_name} version={avatarVersion} onChange={setAvatarVersion} />
            <ProfileEditor profile={profile} about={about} onSaved={(saved) => { setProfile(saved.profile); setAbout(saved.about); }} />
          </section>

          <div id="membership"><SubscriptionCard profile={profile} compact /></div>

          <section className="profile-panel" id="communication" aria-labelledby="settings-communication">
            <h2 id="settings-communication">Communication preferences</h2>
            <form onSubmit={savePreferences}>
              <label className="wq-checkbox"><input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} /><span>Yes, email me Unboxed Together news, events, new services and offers. I can unsubscribe at any time. This is optional and separate from membership or service messages.</span></label>
              {profile.marketing_consented_at && initial.profile.marketing_consent && <p className="settings-note">Consent given on {longDate(profile.marketing_consented_at)}.</p>}
              <p className="settings-note">We will always send essential messages about your account, such as password resets.</p>
              {message('communication')}
              <button className="member-button" type="submit" disabled={status.loading}>Save preferences</button>
            </form>
          </section>

          <section className="profile-panel" id="questionnaire" aria-labelledby="settings-questionnaire">
            <h2 id="settings-questionnaire">Welcome questionnaire</h2>
            <p>{pagesSaved} of {questionnaireSections.length} pages saved. Review or update your answers on any page at any time.</p>
            <Link className="member-button secondary link-button" href="/onboarding?page=1">Review my questionnaire</Link>
          </section>

          <section className="profile-panel" id="privacy" aria-labelledby="settings-privacy">
            <h2 id="settings-privacy">Privacy preferences</h2>
            <p>Your profile picture, profile and answers are private to your account. They are never emailed and are not sent to analytics. Read our <Link href={privacyNoticePath}>Privacy Policy</Link> or contact <a href={`mailto:${privacyContactEmail}`}>{privacyContactEmail}</a>.</p>
            <p className="settings-note">{healthConsentAt ? `Health and wellbeing consent (pages 2 to 4) given on ${longDate(healthConsentAt)}.` : 'You have not given consent for pages 2 to 4 of the welcome questionnaire.'}</p>
            {message('privacy')}
            {healthConsentAt && (answerAction === 'health' ? (
              <div className="delete-confirm"><p>This withdraws your consent and permanently deletes your answers on pages 2 to 4. Your page 1 details stay in place.</p><div><button className="member-button danger-button" type="button" disabled={status.loading} onClick={() => deleteAnswers('health')}>Withdraw consent and delete</button><button className="text-button" type="button" onClick={() => setAnswerAction('')}>Cancel</button></div></div>
            ) : <button className="text-button danger" type="button" onClick={() => setAnswerAction('health')}>Withdraw consent for pages 2 to 4</button>)}
            {answerAction === 'all' ? (
              <div className="delete-confirm"><p>This permanently deletes all of your questionnaire answers. Your login stays active and you will be asked to complete page 1 again.</p><div><button className="member-button danger-button" type="button" disabled={status.loading} onClick={() => deleteAnswers('all')}>Delete all my answers</button><button className="text-button" type="button" onClick={() => setAnswerAction('')}>Cancel</button></div></div>
            ) : <button className="text-button danger" type="button" onClick={() => setAnswerAction('all')}>Delete all my questionnaire answers</button>}
          </section>

          <section className="profile-panel" id="sign-in" aria-labelledby="settings-sign-in">
            <h2 id="settings-sign-in">Password and sign out</h2>
            <p>Use a secure email link to choose a different password.</p>
            <div className="card-actions">
              <Link className="member-button secondary" href="/forgot-password">Change password</Link>
              <button className="member-button secondary" type="button" onClick={signOut}>Sign out</button>
            </div>
          </section>

          <section className="profile-panel danger-panel" id="delete-account" aria-labelledby="settings-delete">
            <h2 id="settings-delete">Delete account</h2>
            <p>This permanently deletes your profile, profile picture, questionnaire answers, consent records, messages, check-ins, and login. This cannot be undone.</p>
            {message('delete')}
            {!showDelete ? <button className="text-button danger" type="button" onClick={() => setShowDelete(true)}>Request account deletion</button> : (
              <div className="delete-confirm"><label htmlFor="delete-confirmation">Type <strong>DELETE MY ACCOUNT</strong> to confirm</label><input id="delete-confirmation" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /><div><button className="member-button danger-button" type="button" disabled={status.loading || confirmation !== 'DELETE MY ACCOUNT'} onClick={deleteAccount}>Permanently delete account</button><button className="text-button" type="button" onClick={() => setShowDelete(false)}>Cancel</button></div></div>
            )}
          </section>
        </div>
      </div>
    </Layout>
  );
}
