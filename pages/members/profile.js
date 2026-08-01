import { useState } from 'react';
import Link from 'next/link';
import { logout, updateUser } from '@netlify/identity';
import Layout from '../../components/Layout';
import SEO from '../../components/SEO';
import FormMessage from '../../components/auth/FormMessage';
import { getMember } from '../../utils/member-server';
import { friendlyAuthError } from '../../utils/auth-errors';

export default function Profile({ profile, email, saved }) {
  const [name, setName] = useState(profile.display_name);
  const [status, setStatus] = useState({ loading: false, error: '', success: saved ? 'Your onboarding answers were updated.' : '' });
  const [showDelete, setShowDelete] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const saveName = async (event) => {
    event.preventDefault(); setStatus({ loading: true, error: '', success: '' });
    try {
      const response = await fetch('/api/member', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile: { displayName: name } }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      await updateUser({ data: { full_name: name.trim() } });
      setStatus({ loading: false, error: '', success: 'Your display name has been updated.' });
    } catch (error) { setStatus({ loading: false, error: friendlyAuthError(error), success: '' }); }
  };
  const signOut = async () => { await logout(); window.location.href = '/'; };
  const deleteAccount = async () => {
    setStatus({ loading: true, error: '', success: '' });
    const response = await fetch('/api/account', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmation }) });
    if (!response.ok) { const data = await response.json(); return setStatus({ loading: false, error: data.error || 'Account deletion could not be completed.', success: '' }); }
    window.location.href = '/';
  };
  return <Layout><SEO title="My profile | Unboxed Together" description="Manage your Unboxed Together profile and onboarding answers." path="/members/profile" /><div className="member-page profile-page"><header className="member-hero compact"><p className="member-kicker">Your account</p><h1>Profile and preferences</h1><p>Keep your details and starting point up to date.</p></header><FormMessage error={status.error} success={status.success} /><div className="profile-grid"><section className="profile-panel"><h2>Personal details</h2><p className="profile-email">Signed in as {email}</p><form className="auth-form" onSubmit={saveName}><label htmlFor="display-name">Display name</label><input id="display-name" value={name} onChange={(e) => setName(e.target.value)} required /><button className="member-button" disabled={status.loading}>Save name</button></form></section><section className="profile-panel"><h2>Your starting point</h2><p>Review or change the answers used to personalise your member experience.</p><Link className="member-button secondary link-button" href="/onboarding?edit=1">Review onboarding answers</Link></section><section className="profile-panel"><h2>Password and session</h2><p>Use a secure email link to choose a different password.</p><Link className="member-button secondary link-button" href="/forgot-password">Change password</Link><button className="text-button" type="button" onClick={signOut}>Log out of this account</button></section><section className="profile-panel danger-panel"><h2>Delete account</h2><p>This permanently deletes your profile, onboarding baseline, future check-ins, and login. This cannot be undone.</p>{!showDelete ? <button className="text-button danger" type="button" onClick={() => setShowDelete(true)}>Request account deletion</button> : <div className="delete-confirm"><label htmlFor="delete-confirmation">Type <strong>DELETE MY ACCOUNT</strong> to confirm</label><input id="delete-confirmation" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /><div><button className="member-button danger-button" type="button" disabled={status.loading || confirmation !== 'DELETE MY ACCOUNT'} onClick={deleteAccount}>Permanently delete account</button><button className="text-button" type="button" onClick={() => setShowDelete(false)}>Cancel</button></div></div>}</section></div></div></Layout>;
}

export async function getServerSideProps(context) {
  const member = await getMember();
  if (!member) return { redirect: { destination: `/login?next=${encodeURIComponent(context.resolvedUrl)}`, permanent: false } };
  if (!member.profile.onboarding_completed) return { redirect: { destination: '/onboarding', permanent: false } };
  return { props: { profile: member.profile, email: member.user.email || '', saved: context.query.saved === '1' } };
}
