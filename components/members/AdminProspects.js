import { useCallback, useEffect, useState } from 'react';
import BrandLoader from '../BrandLoader';
import { projectSegments } from '../../utils/prospect-questionnaire.mjs';

const formatDate = (value) => (value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const permissionLabels = { project_contact: 'Project contact', general_marketing: 'General marketing', sensitive_answers: 'Q2 answers (special category)' };
const marketingLabel = (value) => (value === 'verified' ? 'Confirmed' : value === 'pending' ? 'Awaiting confirmation' : 'No');
const readJson = async (response, fallback) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || fallback);
  return data;
};
const send = (method, body) => fetch('/api/admin/prospects', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

function ProspectDetail({ id, onClose, onChanged }) {
  const [state, setState] = useState({ loading: true, error: '', prospect: null });
  const [erase, setErase] = useState('');

  useEffect(() => {
    fetch(`/api/admin/prospects?view=detail&id=${encodeURIComponent(id)}`)
      .then((response) => readJson(response, 'This record could not be loaded.'))
      .then((data) => setState({ loading: false, error: '', prospect: data.prospect }))
      .catch((error) => setState({ loading: false, error: error.message, prospect: null }));
  }, [id]);

  const update = async (body) => {
    try {
      const data = await readJson(await send('PATCH', { id, ...body }), 'That change could not be saved.');
      setState({ loading: false, error: '', prospect: data.prospect });
      onChanged();
    } catch (error) {
      setState((current) => ({ ...current, error: error.message }));
    }
  };
  const remove = async () => {
    try {
      await readJson(await send('DELETE', { id, confirmation: erase }), 'The record could not be deleted.');
      onChanged();
      onClose();
    } catch (error) {
      setState((current) => ({ ...current, error: error.message }));
    }
  };

  if (state.loading) return <BrandLoader label="Loading record…" />;
  if (!state.prospect) return <p className="onboarding-error" role="alert">{state.error}</p>;
  const p = state.prospect;
  return (
    <section className="profile-panel admin-detail">
      <button className="text-button" type="button" onClick={onClose}>← Back to all prospective members</button>
      <h2>{p.first_name || 'No name given'}</h2>
      <p>Submitted {formatDate(p.submitted_at)}{p.source_campaign ? ` · Campaign: ${p.source_campaign}` : ''} · Kept until {formatDate(p.retain_until)}{p.linked_at ? ` · Joined as member ${p.member_name || ''} (linked ${formatDate(p.linked_at)})` : ''}</p>
      <p>Email: {p.email ? <a href={`mailto:${p.email}`}>{p.email}</a> : p.emailWithheld ? 'Held, but hidden because there is no permission to contact this person.' : 'Not given'}</p>
      {state.error && <p className="onboarding-error" role="alert">{state.error}</p>}
      <h3>1. Would like to understand</h3><p>{p.topics.join(' · ') || '—'}</p>
      <h3>2. Areas they find challenging</h3>
      <p>{p.support_interests.length ? p.support_interests.join(' · ') : 'Not answered, skipped or no consent to keep it.'}</p>
      <h3>3. Projects</h3><p>{p.project_interests.join(' · ') || '—'}</p>
      <h3>4. How they want to get involved</h3><p>{p.involvement.join(' · ') || '—'}</p>
      {p.support_status !== 'none' && (
        <>
          <h3>One-to-one support request</h3>
          <label className="sr-only" htmlFor="support-status">Support request status</label>
          <select id="support-status" className="wq-input" value={p.support_status} onChange={(event) => update({ action: 'support_status', status: event.target.value })}>
            <option value="new">New</option><option value="contacted">Contacted</option><option value="closed">Closed</option>
          </select>
        </>
      )}
      <h3>Permissions</h3>
      <ul className="admin-history">
        <li>Project contact: {p.permissions.project_contact ? 'Yes' : 'No'} {p.permissions.project_contact && <button className="text-button" type="button" onClick={() => update({ action: 'withdraw', type: 'project_contact' })}>Record withdrawal</button>}</li>
        <li>General marketing: {marketingLabel(p.permissions.general_marketing)} {p.permissions.general_marketing && <button className="text-button" type="button" onClick={() => update({ action: 'withdraw', type: 'general_marketing' })}>Record withdrawal</button>}</li>
        <li>Q2 answers kept with explicit consent: {p.permissions.sensitive_answers ? 'Yes' : 'No'} {p.permissions.sensitive_answers && <button className="text-button" type="button" onClick={() => update({ action: 'withdraw', type: 'sensitive_answers' })}>Withdraw and delete Q2 answers</button>}</li>
      </ul>
      <h3>Consent history</h3>
      <ul className="admin-history">
        {p.consentHistory.map((event) => (
          <li key={`${event.permission_type}-${event.recorded_at}`}>
            {formatDate(event.recorded_at)} — {permissionLabels[event.permission_type]} given via {event.source.replace('_', ' ')} ({event.consent_text_version})
            {event.verified_at ? ` · confirmed ${formatDate(event.verified_at)}` : ''}{event.withdrawn_at ? ` · withdrawn ${formatDate(event.withdrawn_at)}` : ''}
          </li>
        ))}
        {!p.consentHistory.length && <li>No permissions given.</li>}
      </ul>
      <h3>Delete this record</h3>
      <p>Use this for erasure requests. The answers, details and consent history are deleted; a hash of the email is kept so it is not contacted again.</p>
      <div className="admin-search">
        <label className="sr-only" htmlFor="erase-confirm">Type DELETE to confirm</label>
        <input id="erase-confirm" className="wq-input" value={erase} onChange={(event) => setErase(event.target.value)} placeholder="Type DELETE to confirm" />
        <button className="member-button secondary" type="button" disabled={erase !== 'DELETE'} onClick={remove}>Delete permanently</button>
      </div>
    </section>
  );
}

export default function AdminProspects() {
  const [filters, setFilters] = useState({ search: '', segment: '', permission: '', registered: '', support: '' });
  const [state, setState] = useState({ loading: true, error: '', data: null });
  const [selected, setSelected] = useState('');
  const [exportSegment, setExportSegment] = useState('barcode');

  const load = useCallback(() => {
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    fetch(`/api/admin/prospects?${params}`)
      .then((response) => readJson(response, 'Prospective members could not be loaded.'))
      .then((data) => setState({ loading: false, error: '', data }))
      .catch((error) => setState({ loading: false, error: error.message, data: null }));
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(load, filters.search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, filters.search]);

  if (selected) return <ProspectDetail id={selected} onClose={() => setSelected('')} onChanged={load} />;
  if (state.loading) return <BrandLoader label="Loading prospective members…" />;
  if (state.error) return <p className="onboarding-error" role="alert">{state.error}</p>;
  const { summary, prospects, emailDelivery } = state.data;
  const tiles = [
    ['Total submissions', summary.total],
    ['Barcode Challenge', summary.barcode],
    ['App testing', summary.app],
    ['Food database', summary.database],
    ['Community discussions', summary.community],
    ['Group walks', summary.walks],
    ['Personal support requests', summary.support],
    ['Marketing subscribers (confirmed)', summary.marketing_verified],
    ['Later registered as members', summary.registered],
  ];
  const setFilter = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));

  return (
    <div className="admin-progress">
      <section className="profile-panel">
        <h2>Prospective members &amp; interest</h2>
        <p>People who registered interest at /join-us. They are not members and have no account unless they later joined and linked their form. Every view and export is recorded.</p>
        <ul className="admin-tiles">{tiles.map(([label, value]) => <li key={label}><strong>{value}</strong><span>{label}</span></li>)}</ul>
        <p className="dashboard-note">{summary.marketing_pending} awaiting marketing confirmation · {summary.project_contact} with project contact permission · {summary.support_new} new support {summary.support_new === 1 ? 'request' : 'requests'}{emailDelivery ? '' : ' · Email delivery is not configured, so confirmation emails are queued and not sent.'}</p>
      </section>

      <section className="profile-panel">
        <h2>Export contacts</h2>
        <p>Exports include only people with a valid, current permission. Use them in your email marketing service, which must provide unsubscribe links. Nothing is sent from here.</p>
        <div className="admin-search">
          <a className="member-button" href="/api/admin/prospects?view=export&kind=marketing">General marketing (confirmed only)</a>
          <label className="sr-only" htmlFor="export-segment">Project</label>
          <select id="export-segment" className="wq-input" value={exportSegment} onChange={(event) => setExportSegment(event.target.value)}>
            {Object.entries(projectSegments).map(([key, segment]) => <option key={key} value={key}>{segment.label}</option>)}
          </select>
          <a className="member-button secondary" href={`/api/admin/prospects?view=export&kind=project&segment=${exportSegment}`}>Project updates for this project</a>
        </div>
      </section>

      <section className="profile-panel">
        <h2>{prospects.length} {prospects.length === 1 ? 'submission' : 'submissions'}</h2>
        <div className="admin-search">
          <label className="sr-only" htmlFor="prospect-search">Search</label>
          <input id="prospect-search" className="wq-input" type="search" value={filters.search} onChange={setFilter('search')} placeholder="Search by first name or email" />
          <select className="wq-input" aria-label="Project" value={filters.segment} onChange={setFilter('segment')}>
            <option value="">All projects</option>
            {Object.entries(projectSegments).map(([key, segment]) => <option key={key} value={key}>{segment.label}</option>)}
          </select>
          <select className="wq-input" aria-label="Permission" value={filters.permission} onChange={setFilter('permission')}>
            <option value="">Any permission</option><option value="project_contact">Project contact</option><option value="general_marketing">Confirmed marketing</option><option value="none">No contact permission</option>
          </select>
          <select className="wq-input" aria-label="Registered" value={filters.registered} onChange={setFilter('registered')}>
            <option value="">Members and non-members</option><option value="yes">Registered as members</option><option value="no">Not registered</option>
          </select>
          <select className="wq-input" aria-label="Support requests" value={filters.support} onChange={setFilter('support')}>
            <option value="">All</option><option value="new">Support requests: new</option><option value="contacted">Support requests: contacted</option><option value="closed">Support requests: closed</option>
          </select>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>First name</th><th>Submitted</th><th>Projects</th><th>Contact</th><th>Marketing</th><th>Support</th><th>Member</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {prospects.map((item) => (
                <tr key={item.id}>
                  <td>{item.first_name || '—'}</td>
                  <td>{formatDate(item.submitted_at)}</td>
                  <td>{item.project_interests.join(', ') || '—'}</td>
                  <td>{item.permissions.project_contact ? 'Yes' : 'No'}</td>
                  <td>{marketingLabel(item.permissions.general_marketing)}</td>
                  <td>{item.support_status === 'none' ? '—' : item.support_status}</td>
                  <td>{item.registered ? 'Yes' : 'No'}</td>
                  <td><button className="text-button" type="button" onClick={() => setSelected(item.id)}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
