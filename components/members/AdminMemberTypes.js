import { useEffect, useState } from 'react';
import BrandLoader from '../BrandLoader';
import { assignableMemberTypes, memberTypes } from '../../utils/member-types.mjs';

const readJson = async (response, fallback) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || fallback);
  return data;
};

// Assigns Free Member, Subscribed Member or Moderator. Admins and owners are
// shown here but managed in Admin access.
export default function AdminMemberTypes() {
  const [state, setState] = useState({ loading: true, error: '', members: [] });
  const [filter, setFilter] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    fetch('/api/admin/member-types')
      .then((response) => readJson(response, 'Member types could not be loaded.'))
      .then((data) => setState({ loading: false, error: '', members: data.members }))
      .catch((error) => setState({ loading: false, error: error.message, members: [] }));
  }, []);

  const assign = async (member, memberType) => {
    setNotice('');
    try {
      const data = await readJson(await fetch('/api/admin/member-types', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ member, memberType }) }), 'That change could not be saved.');
      setState((current) => ({ ...current, members: data.members }));
    } catch (error) {
      setNotice(error.message);
    }
  };

  if (state.loading) return <BrandLoader label="Loading member types…" />;
  if (state.error) return <p className="onboarding-error" role="alert">{state.error}</p>;
  const term = filter.trim().toLowerCase();
  const shown = term ? state.members.filter((member) => `${member.display_name} ${member.email || ''}`.toLowerCase().includes(term)) : state.members;
  const counts = Object.fromEntries(Object.keys(memberTypes).map((type) => [type, state.members.filter((member) => member.memberType === type).length]));

  return (
    <section className="profile-panel">
      <h2>Member types</h2>
      <p>Each member’s type shows under their name on their dashboard. Free and Subscribed Members currently see and can do the same things. Moderators have the same access as other members for now. Admins and Owners are managed in Admin access.</p>
      <p className="dashboard-note">{Object.entries(memberTypes).map(([type, label]) => `${label}: ${counts[type]}`).join(' · ')}</p>
      <label className="sr-only" htmlFor="member-type-filter">Find a member</label>
      <input id="member-type-filter" className="wq-input" type="search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Find a member by name or email" />
      {notice && <p className="onboarding-error" role="alert">{notice}</p>}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Name</th><th>Email</th><th>Member type</th></tr></thead>
          <tbody>
            {shown.map((member) => (
              <tr key={member.id}>
                <td>{member.display_name || 'Member'}</td>
                <td>{member.email || '—'}</td>
                <td>
                  {member.managedByAllowlist ? `${memberTypes[member.memberType]} (Admin access)` : (
                    <select className="wq-input" aria-label={`Member type for ${member.display_name || 'member'}`} value={member.memberType} onChange={(event) => assign(member.id, event.target.value)}>
                      {assignableMemberTypes.map((type) => <option key={type} value={type}>{memberTypes[type]}</option>)}
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
