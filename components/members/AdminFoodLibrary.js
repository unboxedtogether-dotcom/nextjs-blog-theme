import { useEffect, useState } from 'react';
import BrandLoader from '../BrandLoader';
import { formatDateTime, postJson, readJson } from './AdminUi';

const maxBytes = 5 * 1024 * 1024;

function IssueList({ title, items, render, tone }) {
  if (!items.length) return null;
  return (
    <details className={`food-import-group is-${tone}`} open={tone !== 'grey'}>
      <summary>{title} ({items.length})</summary>
      <ul>{items.slice(0, 300).map((item, index) => <li key={`${item.ingredientId || ''}-${item.line || index}`}>{render(item)}</li>)}</ul>
      {items.length > 300 && <p className="dashboard-note">Showing the first 300.</p>}
    </details>
  );
}

// Ingredient Library imports: upload a CSV export of the master sheet,
// review exactly what would change, then confirm. Records are matched on
// their UIL code, so re-importing never creates duplicates and nothing is
// deleted. Additive records are not affected.
export default function AdminFoodLibrary() {
  const [state, setState] = useState({ loading: true, error: '', counts: null, batches: [] });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState({ tone: '', text: '' });

  const load = () => fetch('/api/admin/food-library')
    .then((response) => readJson(response, 'The food library could not be loaded.'))
    .then((data) => setState({ loading: false, error: '', counts: data.counts, batches: data.batches }))
    .catch((error) => setState({ loading: false, error: error.message, counts: null, batches: [] }));
  useEffect(() => { load(); }, []);

  const choose = async (event) => {
    const chosen = event.target.files?.[0];
    setPreview(null);
    setNotice({ tone: '', text: '' });
    if (!chosen) { setFile(null); return; }
    if (chosen.size > maxBytes) { setFile(null); setNotice({ tone: 'error', text: 'That file is larger than 5 MB. Export the Ingredient Library sheet only.' }); return; }
    if (/\.(pdf|xlsx?|numbers)$/i.test(chosen.name)) { setFile(null); setNotice({ tone: 'error', text: 'Upload a CSV file. In Google Sheets choose File → Download → Comma-separated values (.csv).' }); return; }
    setFile({ name: chosen.name, text: await chosen.text() });
  };

  const run = async (action) => {
    setBusy(action);
    setNotice({ tone: '', text: '' });
    try {
      const data = await readJson(await postJson('/api/admin/food-library', { action, csv: file.text, fileName: file.name, fingerprint: preview?.fingerprint }), 'The file could not be processed.');
      if (action === 'preview') setPreview(data);
      else {
        setNotice({ tone: 'success', text: `Import applied: ${data.summary.created} added, ${data.summary.updated} updated, ${data.summary.unchanged} unchanged.` });
        setPreview(null);
        setFile(null);
        load();
      }
    } catch (error) {
      setNotice({ tone: 'error', text: error.message });
    }
    setBusy('');
  };

  if (state.loading) return <BrandLoader label="Loading food library…" />;
  if (state.error) return <p className="onboarding-error" role="alert">{state.error}</p>;
  const { counts } = state;
  const changes = preview ? preview.summary.created + preview.summary.updated : 0;

  return (
    <section className="profile-panel food-import">
      <h2>Food library</h2>
      <p>The Food Database search covers both libraries. Ingredient records can be added or updated here from the Ingredient Library master sheet. Additive records are managed separately and are not changed by this tool.</p>
      <div className="food-import-stats">
        <div><strong>{counts.published_ingredients}</strong><span>published ingredients{counts.ingredients !== counts.published_ingredients ? ` of ${counts.ingredients}` : ''}</span></div>
        <div><strong>{counts.published_additives}</strong><span>published additives of {counts.additives}</span></div>
      </div>

      <h3>Import an updated Ingredient Library</h3>
      <ol className="food-import-steps">
        <li>In Google Sheets, open the Ingredient Library and choose <strong>File → Download → Comma-separated values (.csv)</strong>. A file containing only some rows (for example, new additions) is fine.</li>
        <li>Choose the file below and select <strong>Preview changes</strong>. Nothing is saved yet.</li>
        <li>Check the new, updated, duplicate and rejected records, then select <strong>Apply import</strong>.</li>
      </ol>
      <div className="food-import-picker">
        <input type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" onChange={choose} aria-label="Ingredient Library CSV file" />
        <button className="member-button" type="button" disabled={!file || Boolean(busy)} onClick={() => run('preview')}>{busy === 'preview' ? 'Checking…' : 'Preview changes'}</button>
      </div>
      {notice.text && <p className={notice.tone === 'error' ? 'onboarding-error' : 'form-success'} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.text}</p>}

      {preview && (
        <div className="food-import-preview">
          <h3>Preview of {preview.fileName}</h3>
          <div className="food-import-stats is-small">
            <div className="is-green"><strong>{preview.summary.created}</strong><span>new</span></div>
            <div className="is-blue"><strong>{preview.summary.updated}</strong><span>updated</span></div>
            <div><strong>{preview.summary.unchanged}</strong><span>unchanged</span></div>
            <div className="is-amber"><strong>{preview.summary.duplicates}</strong><span>duplicates held back</span></div>
            <div className="is-red"><strong>{preview.summary.rejected}</strong><span>rejected</span></div>
          </div>
          {preview.missingColumns.length > 0 && <p className="onboarding-error">These columns were not found in the file, so new records will have them blank and existing records keep their current values: {preview.missingColumns.join(', ')}.</p>}
          {preview.extraColumns.length > 0 && <p className="dashboard-note">Extra columns will be kept under “Additional information”: {preview.extraColumns.join(', ')}.</p>}
          {preview.summary.notInFile > 0 && <p className="dashboard-note">{preview.summary.notInFile} existing records are not in this file. They will be left exactly as they are.</p>}

          <IssueList title="Rejected rows" tone="red" items={preview.rejected} render={(item) => <><strong>Row {item.line}{item.ingredientId ? ` · ${item.ingredientId}` : ''}{item.name ? ` · ${item.name}` : ''}</strong> — {item.reasons.join('; ')}</>} />
          <IssueList title="Duplicates held back" tone="amber" items={preview.duplicates} render={(item) => <><strong>Row {item.line} · {item.ingredientId} · {item.name}</strong> — {item.reason}</>} />
          <IssueList title="New records" tone="green" items={preview.created} render={(item) => <><strong>{item.ingredientId}</strong> {item.name} <span className="dashboard-note">{item.category}</span></>} />
          <IssueList title="Updated records" tone="blue" items={preview.updated} render={(item) => <><strong>{item.ingredientId}</strong> {item.name} <span className="dashboard-note">Changed: {item.fields.join(', ')}</span></>} />

          <div className="food-import-actions">
            <button className="member-button" type="button" disabled={!changes || Boolean(busy)} onClick={() => run('apply')}>{busy === 'apply' ? 'Applying…' : `Apply import (${changes} ${changes === 1 ? 'record' : 'records'})`}</button>
            <button className="member-button secondary" type="button" disabled={Boolean(busy)} onClick={() => setPreview(null)}>Cancel</button>
          </div>
        </div>
      )}

      <h3>Import history</h3>
      {state.batches.length === 0 ? <p>No imports yet.</p> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Date</th><th>File</th><th>By</th><th>New</th><th>Updated</th><th>Unchanged</th><th>Held back</th></tr></thead>
            <tbody>
              {state.batches.map((batch) => (
                <tr key={batch.id}>
                  <td>{formatDateTime(batch.created_at)}</td><td>{batch.source_name}</td><td>{batch.imported_by}</td>
                  <td>{batch.created_count}</td><td>{batch.updated_count}</td><td>{batch.unchanged_count}</td><td>{batch.rejected_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
