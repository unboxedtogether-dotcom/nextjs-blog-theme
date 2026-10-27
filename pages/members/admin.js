import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import SEO from '../../components/SEO';
import { useMemberData } from '../../utils/use-member-data';
import BrandLoader from '../../components/BrandLoader';
import AdminReviews from '../../components/members/AdminReviews';
import AdminProgress from '../../components/members/AdminProgress';
import AdminAccess from '../../components/members/AdminAccess';
import AdminMemberTypes from '../../components/members/AdminMemberTypes';
import AdminProspects from '../../components/members/AdminProspects';
import MemberDetail from '../../components/members/AdminQuestionnaireDetail';
import AdminOverview from '../../components/members/AdminOverview';
import AdminMembers from '../../components/members/AdminMembers';
import AdminMemberRecord from '../../components/members/AdminMemberRecord';
import AdminEmails from '../../components/members/AdminEmails';
import AdminReferrals from '../../components/members/AdminReferrals';
import AdminFoodLibrary from '../../components/members/AdminFoodLibrary';

const tabs = [
  ['overview', 'Overview'],
  ['members', 'Members'],
  ['emails', 'Emails & reminders'],
  ['referrals', 'Referrals'],
  ['progress', 'Member progress'],
  ['questionnaires', 'Questionnaires'],
  ['messages', 'Messages'],
  ['prospects', 'Prospective members'],
  ['reviews', 'Book reviews'],
  ['food', 'Food library'],
  ['types', 'Member types'],
  ['access', 'Admin access'],
];

const formatDate = (value) => (value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

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

  if (state.loading) return <BrandLoader label="Loading messages…" />;
  if (state.error) return <p className="onboarding-error" role="alert">{state.error}</p>;
  const newCount = state.messages.filter((item) => item.status === 'new').length;
  return (
    <section className="profile-panel">
      <h2>{newCount} new {newCount === 1 ? 'message' : 'messages'} <small>of {state.messages.length}</small></h2>
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
  const router = useRouter();
  const [selected, setSelected] = useState('');
  // The open section, member and filter live in the address, so the back
  // button and reloads keep the admin where they were.
  const query = router.isReady ? router.query : {};
  const tab = tabs.some(([key]) => key === query.tab) ? query.tab : 'overview';
  const memberId = typeof query.member === 'string' ? query.member : '';
  const memberFilter = typeof query.filter === 'string' ? query.filter : 'all';
  const emailFilters = useMemo(() => ({ status: typeof query.status === 'string' ? query.status : '', kind: typeof query.kind === 'string' ? query.kind : '' }), [query.status, query.kind]);
  const navigate = (next) => {
    const params = Object.fromEntries(Object.entries({ tab: next.tab, member: next.member, filter: next.filter, status: next.status, kind: next.kind }).filter(([, value]) => value));
    router.push({ pathname: '/members/admin', query: params }, undefined, { shallow: true });
    window.scrollTo({ top: 0 });
  };
  const setTab = (key) => navigate({ tab: key });
  const openMember = (id) => navigate({ tab: 'members', member: id, filter: memberFilter !== 'all' ? memberFilter : undefined });

  return (
    <Layout>
      <SEO title="Team area | Unboxed Together" description="Restricted member questionnaire access." path="/members/admin" />
      <Head><meta name="robots" content="noindex, nofollow" /></Head>
      <div className="member-page profile-page">
        <header className="member-hero compact"><p className="member-kicker">Team only</p><h1>Team area</h1><p>Confidential. Member records are read-only and every view, note, reminder and export is recorded. Do not copy answers into email.</p></header>
        <nav className="dashboard-nav admin-nav" aria-label="Team area sections">
          {tabs.map(([key, label]) => <button key={key} type="button" className={tab === key ? 'is-active' : ''} aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}>{label}</button>)}
        </nav>
        {tab === 'overview' && data && <AdminOverview onNavigate={navigate} />}
        {tab === 'members' && data && (memberId
          ? <AdminMemberRecord key={memberId} id={memberId} onClose={() => navigate({ tab: 'members', filter: memberFilter !== 'all' ? memberFilter : undefined })} />
          : <AdminMembers key={memberFilter} initialFilter={memberFilter} onOpenMember={openMember} />)}
        {tab === 'emails' && data && <AdminEmails key={`${emailFilters.status}-${emailFilters.kind}`} initialFilters={emailFilters} onOpenMember={openMember} />}
        {tab === 'referrals' && data && <AdminReferrals onOpenMember={openMember} />}
        {tab === 'progress' && !error && <AdminProgress />}
        {tab === 'types' && !error && <AdminMemberTypes />}
        {tab === 'access' && !error && <AdminAccess />}
        {tab === 'messages' && !error && <MemberMessages />}
        {tab === 'prospects' && !error && <AdminProspects />}
        {tab === 'reviews' && !error && <AdminReviews />}
        {tab === 'food' && !error && <AdminFoodLibrary />}
        {error && <p className="onboarding-error" role="alert">{error}</p>}
        {loading && !error && <BrandLoader label="Checking your team access…" />}
        {tab === 'questionnaires' && data && (selected ? <MemberDetail id={selected} onClose={() => setSelected('')} /> : (
          <section className="profile-panel">
            <h2>{data.members.length} {data.members.length === 1 ? 'member' : 'members'}</h2>
            <p className="dashboard-note">{data.members.filter((member) => member.completed_at).length} completed page 1 · {data.members.filter((member) => member.consent_given_at).length} gave consent for pages 2 to 4 · {data.members.filter((member) => !member.completed_at).length} not started</p>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Name</th><th>Email</th><th>Page 1</th><th>Consent</th><th>Pages saved</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {data.members.map((member) => (
                    <tr key={member.id}>
                      <td>{member.display_name || 'Member'}</td>
                      <td className="admin-table__member">{member.email || '—'}</td>
                      <td>{member.completed_at ? formatDate(member.completed_at) : 'Not started'}</td>
                      <td>{member.consent_given_at ? formatDate(member.consent_given_at) : 'Not given'}</td>
                      <td>{[2, 3, 4].filter((number) => member[`section_${number}_saved_at`]).join(', ') || '—'}</td>
                      <td>{member.completed_at ? <button className="text-button" type="button" onClick={() => setSelected(member.id)}>View answers</button> : '—'}</td>
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
