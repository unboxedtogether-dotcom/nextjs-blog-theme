import { useEffect, useState } from 'react';
import BrandLoader from '../BrandLoader';

const formatDate = (value) => (value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const actionLabels = {
  view_questionnaires: 'Viewed questionnaires', list_questionnaires: 'Listed questionnaires', view_questionnaire: 'Viewed questionnaire',
  list_messages: 'Listed messages', mark_message_read: 'Marked message read', list_member_progress: 'Listed member progress',
  search_member_progress: 'Searched members', view_member_progress: 'Viewed member progress', view_submission: 'Opened a submission',
  add_private_note: 'Added a private note', export_member_report: 'Exported a progress report', view_access_log: 'Viewed this log',
  allowlist_add: 'Added an admin', allowlist_remove: 'Removed an admin',
};

const send = async (method, email) => {
  const response = await fetch('/api/admin/access', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'That change could not be saved.');
  return data.entries;
};

// Database admin allowlist and the record of admin access to member data.
export default function AdminAccess() {
  const [state, setState] = useState({ loading: true, error: '', entries: [], log: [] });
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    fetch('/api/admin/access')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Admin access could not be loaded.');
        setState({ loading: false, error: '', entries: data.entries, log: data.log });
      })
      .catch((error) => setState({ loading: false, error: error.message, entries: [], log: [] }));
  }, []);

  const change = async (method, value) => {
    setNotice('');
    try {
      const entries = await send(method, value);
      setState((current) => ({ ...current, entries }));
      if (method === 'POST') setEmail('');
    } catch (error) {
      setNotice(error.message);
    }
  };

  if (state.loading) return <BrandLoader label="Loading admin access…" />;
  if (state.error) return <p className="onboarding-error" role="alert">{state.error}</p>;
  return (
    <>
      <section className="profile-panel">
        <h2>Database admin allowlist</h2>
        <p>Admin access to member records needs both the Identity <strong>admin</strong> role and an entry here. An email is linked to its Identity account the first time that admin opens the team area; after that, only the linked account counts.</p>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Email</th><th>Status</th><th>Added</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {state.entries.map((entry) => (
                <tr key={entry.email}>
                  <td>{entry.email}{entry.isYou ? ' (you)' : ''}</td>
                  <td>{entry.bound ? `Linked ${formatDate(entry.bound_at)}` : 'Waiting for first sign-in'}</td>
                  <td>{formatDate(entry.added_at)}</td>
                  <td>{!entry.isYou && <button className="text-button danger" type="button" onClick={() => { if (window.confirm(`Remove ${entry.email} from the admin allowlist?`)) change('DELETE', entry.email); }}>Remove</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form className="admin-search" onSubmit={(event) => { event.preventDefault(); change('POST', email); }}>
          <label className="sr-only" htmlFor="admin-email">Admin email</label>
          <input id="admin-email" className="wq-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Add an admin by email" />
          <button className="member-button secondary" type="submit" disabled={!email.trim()}>Add</button>
        </form>
        <p className="dashboard-note">The person also needs the admin role in Netlify Identity. Remove addresses that are no longer in use.</p>
        {notice && <p className="onboarding-error" role="alert">{notice}</p>}
      </section>
      <section className="profile-panel">
        <h2>Admin access log</h2>
        <p>The latest 200 admin actions on member records.</p>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Member</th><th>Detail</th></tr></thead>
            <tbody>
              {state.log.map((row) => (
                <tr key={row.id}>
                  <td>{formatDate(row.accessed_at)}</td>
                  <td>{row.admin_name || row.admin_user_id}</td>
                  <td>{actionLabels[row.action] || row.action}</td>
                  <td>{row.member_name || (row.member_user_id ? 'Unknown member' : '—')}</td>
                  <td>{row.detail || row.resource_type || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
