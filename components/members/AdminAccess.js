import { useEffect, useState } from 'react';
import BrandLoader from '../BrandLoader';

const formatDate = (value) => (value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const actionLabels = {
  view_questionnaires: 'Viewed questionnaires', list_questionnaires: 'Listed questionnaires', view_questionnaire: 'Viewed questionnaire',
  list_messages: 'Listed messages', mark_message_read: 'Marked message read', list_member_progress: 'Listed member progress',
  search_member_progress: 'Searched members', view_member_progress: 'Viewed member progress', view_submission: 'Opened a submission',
  add_private_note: 'Added a private note', export_member_report: 'Exported a progress report', view_access_log: 'Viewed this log',
  allowlist_add: 'Added an admin', allowlist_remove: 'Removed an admin', allowlist_role: 'Changed an admin role',
  list_member_types: 'Listed member types', set_member_type: 'Changed a member type', send_reminder: 'Sent a reminder email',
  moderate_review: 'Moderated a book review', delete_review: 'Deleted a book review',
  list_prospects: 'Listed prospective members', view_prospect: 'Viewed a prospective member', export_prospects: 'Exported contacts',
  erase_prospect: 'Deleted a prospective member', prospect_support_status: 'Updated a support request', prospect_withdraw_permission: 'Recorded a permission withdrawal',
};
const detailLabels = { checkin: 'Check-in reminder', welcome: 'Welcome form reminder', free: 'Free Member', subscribed: 'Subscribed Member', moderator: 'Moderator' };
const roleLabels = { admin: 'Admin', owner: 'Owner' };

const send = async (method, email, role) => {
  const response = await fetch('/api/admin/access', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, role }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'That change could not be saved.');
  return data.entries;
};

// Database admin allowlist and the record of admin access to member data.
export default function AdminAccess() {
  const [state, setState] = useState({ loading: true, error: '', entries: [], log: [], role: null });
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState('');
  const [changesOnly, setChangesOnly] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/access${changesOnly ? '?filter=changes' : ''}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Admin access could not be loaded.');
        setState({ loading: false, error: '', entries: data.entries, log: data.log, role: data.role });
      })
      .catch((error) => setState({ loading: false, error: error.message, entries: [], log: [] }));
  }, [changesOnly]);

  const change = async (method, value, role) => {
    setNotice('');
    try {
      const entries = await send(method, value, role);
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
        <p>Each entry is an <strong>Admin</strong> or an <strong>Owner</strong>. Both have the same team area access; only owners can change these roles or remove an owner.</p>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Email</th><th>Member type</th><th>Status</th><th>Added</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {state.entries.map((entry) => (
                <tr key={entry.email}>
                  <td>{entry.email}{entry.isYou ? ' (you)' : ''}</td>
                  <td>
                    {state.role === 'owner' && !entry.isYou ? (
                      <select className="wq-input" aria-label={`Member type for ${entry.email}`} value={entry.role} onChange={(event) => change('PATCH', entry.email, event.target.value)}>
                        {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    ) : roleLabels[entry.role]}
                  </td>
                  <td>{entry.bound ? `Linked ${formatDate(entry.bound_at)}` : 'Waiting for first sign-in'}</td>
                  <td>{formatDate(entry.added_at)}</td>
                  <td>{!entry.isYou && (entry.role !== 'owner' || state.role === 'owner') && <button className="text-button danger" type="button" onClick={() => { if (window.confirm(`Remove ${entry.email} from the admin allowlist?`)) change('DELETE', entry.email); }}>Remove</button>}</td>
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
        <p>The latest 200 admin actions on member records{changesOnly ? ' that changed something (notes, member types, admin access, reminders, reviews and exports)' : ''}.</p>
        <div className="review-filters">
          <button type="button" className={!changesOnly ? 'is-active' : ''} onClick={() => setChangesOnly(false)}>Everything</button>
          <button type="button" className={changesOnly ? 'is-active' : ''} onClick={() => setChangesOnly(true)}>Changes only</button>
        </div>
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
                  <td>{detailLabels[row.detail] || row.detail || row.resource_type || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
