import { useState } from 'react';
import Link from 'next/link';
import Layout from '../Layout';
import MemberAvatar from './MemberAvatar';
import ProfileEditor, { AvatarControls } from './ProfileEditor';
import WelcomeFormCard from './WelcomeFormCard';
import ProgressComingSoon from './ProgressComingSoon';
import ProgressCard from './ProgressCard';
import SubscriptionCard from './SubscriptionCard';
import ContactForm from './ContactForm';
import CommunityComingSoon from './CommunityComingSoon';
import { BrandImage } from '../BrandLogo';

const sectionLinks = [['#my-profile', 'My profile'], ['#my-welcome-form', 'Welcome form'], ['#my-progress', 'Progress'], ['#my-community', 'Community'], ['#my-subscription', 'Subscription'], ['#contact', 'Contact us']];

function ProfileSummary({ profile, about, onEdit }) {
  const empty = !profile.bio && !about.interests && !about.reasons.length;
  return (
    <div className="profile-summary">
      {profile.bio ? <p className="profile-bio">{profile.bio}</p> : <p className="profile-placeholder">Add a short bio so we can get to know you a little.</p>}
      {about.interests && <div className="profile-detail"><strong>Enjoys</strong><p>{about.interests}</p></div>}
      {about.reasons.length > 0 && <div className="profile-detail"><strong>What brings me here</strong><ul className="profile-tags">{about.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>}
      {about.town && <div className="profile-detail"><strong>Area</strong><p>{about.town}</p></div>}
      <button className="member-button secondary" type="button" onClick={onEdit}>{empty ? 'Complete my profile' : 'Edit my profile'}</button>
    </div>
  );
}

export default function Dashboard({ initial, email, seo, notice = null }) {
  const [profile, setProfile] = useState(initial.profile);
  const [about, setAbout] = useState(initial.about);
  const [avatarVersion, setAvatarVersion] = useState(initial.profile.avatar_updated_at);
  const [editing, setEditing] = useState(false);
  const plan = (profile.membership_tier_name || 'Free Member').toUpperCase();

  return (
    <Layout>
      {seo}
      {notice}
      <div className="member-page dashboard-page">
        <header className="member-hero dashboard-hero">
          <BrandImage variant="horizontal" className="dashboard-hero__logo" alt="" sizes="140px" />
          <MemberAvatar name={profile.display_name} version={avatarVersion} size="xl" />
          <div>
            <p className="member-kicker">Your member space</p>
            <h1>Welcome, {profile.display_name}.</h1>
            <p className="hero-badges"><span className="plan-badge on-dark">{plan}</span><span>Membership active</span></p>
            {initial.isAdmin && <p><Link className="member-button" href="/members/admin">Open admin / team area →</Link></p>}
          </div>
        </header>
        <nav className="dashboard-nav" aria-label="Dashboard sections">
          {sectionLinks.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
          <Link href="/members/progress">My progress</Link>
          <Link href="/members/forms">My forms &amp; assessments</Link>
          <Link href="/members/profile">Account settings</Link>
          {initial.isAdmin && <Link href="/members/admin">Admin / Team area</Link>}
        </nav>

        <div className="dashboard-layout">
          <section className="dashboard-card my-profile-card" id="my-profile" aria-labelledby="my-profile-heading">
            <span>My profile</span>
            <h2 id="my-profile-heading">{editing ? 'Edit my profile' : 'About me'}</h2>
            {editing ? (
              <>
                <AvatarControls name={profile.display_name} version={avatarVersion} onChange={setAvatarVersion} />
                <ProfileEditor profile={profile} about={about} onCancel={() => setEditing(false)} onSaved={(saved) => { setProfile(saved.profile); setAbout(saved.about); }} />
              </>
            ) : <ProfileSummary profile={profile} about={about} onEdit={() => setEditing(true)} />}
          </section>

          <div id="my-welcome-form"><WelcomeFormCard questionnaire={initial.questionnaire} /></div>
          <div id="my-subscription"><SubscriptionCard profile={profile} /></div>
          <div id="my-progress"><ProgressCard progress={initial.progress} /></div>
          <div id="my-community"><CommunityComingSoon /></div>
          <ProgressComingSoon />

          <Link className="dashboard-card dashboard-card-primary additive-shortcut" href="/additives">
            <span>Additive search</span>
            <h2>Look up an ingredient</h2>
            <p>Search the full library and see complete Unboxed breakdowns.</p>
            <strong>Open additive search →</strong>
          </Link>

          <ContactForm email={email} />

          <Link className="dashboard-card account-shortcut" href="/members/profile">
            <span>Account settings</span>
            <h2>Preferences and privacy</h2>
            <p>Communication choices, privacy, password, sign out and account deletion.</p>
            <strong>Open account settings →</strong>
          </Link>

          {initial.isAdmin && (
            <Link className="dashboard-card account-shortcut" href="/members/admin">
              <span>Team only</span>
              <h2>Member progress, questionnaires and messages</h2>
              <p>Read-only access to members’ progress, answers and private messages, plus book review moderation.</p>
              <strong>Open team area →</strong>
            </Link>
          )}
        </div>
      </div>
    </Layout>
  );
}
