import { useEffect, useState } from 'react';
import Stars from '../book/Stars';
import BrandLoader from '../BrandLoader';

const formatDate = (value) => (value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const filters = [['pending', 'Awaiting review'], ['approved', 'Published'], ['rejected', 'Rejected'], ['removed', 'Removed'], ['all', 'All']];
const statusLabels = { pending: 'Awaiting review', approved: 'Published', rejected: 'Rejected', removed: 'Removed from site' };

// Moderators change publication status only. Review text and ratings are shown exactly as submitted.
export default function AdminReviews() {
  const [state, setState] = useState({ loading: true, error: '', reviews: [] });
  const [filter, setFilter] = useState('pending');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    fetch('/api/admin/reviews')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Reviews could not be loaded.');
        setState({ loading: false, error: '', reviews: data.reviews });
      })
      .catch((error) => setState({ loading: false, error: error.message, reviews: [] }));
  }, []);

  const send = async (id, method, body) => {
    setBusy(id);
    setNotice('');
    try {
      const response = await fetch('/api/admin/reviews', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'That change could not be saved.');
      setState((current) => ({
        ...current,
        reviews: method === 'DELETE'
          ? current.reviews.filter((review) => review.id !== id)
          : current.reviews.map((review) => (review.id === id ? { ...review, ...data.review } : review)),
      }));
    } catch (error) {
      setNotice(error.message);
    }
    setBusy('');
  };
  const setStatus = (id, status) => send(id, 'PATCH', { status });
  const remove = (id) => { if (window.confirm('Permanently delete this rejected review? This cannot be undone.')) send(id, 'DELETE'); };

  if (state.loading) return <BrandLoader label="Loading reviews…" />;
  if (state.error) return <p className="onboarding-error" role="alert">{state.error}</p>;

  const counts = Object.fromEntries(filters.map(([key]) => [key, key === 'all' ? state.reviews.length : state.reviews.filter((review) => review.status === key).length]));
  const shown = filter === 'all' ? state.reviews : state.reviews.filter((review) => review.status === filter);

  return (
    <section className="profile-panel">
      <h2>Book reviews</h2>
      <p>Approve genuine reviews — positive and negative alike. Reject spam or abusive content. Reviewer email addresses are private and never published.</p>
      <div className="review-filters" role="group" aria-label="Filter reviews">
        {filters.map(([key, label]) => <button key={key} type="button" className={filter === key ? 'is-active' : ''} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label} ({counts[key]})</button>)}
      </div>
      {notice && <p className="onboarding-error" role="alert">{notice}</p>}
      {shown.length === 0 && <p>No reviews here.</p>}
      <ul className="admin-reviews">
        {shown.map((review) => (
          <li key={review.id} className={`admin-review is-${review.status}`}>
            <div className="admin-review__head">
              <Stars rating={review.rating} />
              <span className={`review-status is-${review.status}`}>{statusLabels[review.status]}</span>
            </div>
            <h3>{review.headline}</h3>
            <p className="admin-review__body">{review.body}</p>
            <dl className="admin-review__meta">
              <div><dt>Name</dt><dd>{review.display_name}{review.from_member ? ' (member)' : ''}</dd></div>
              <div><dt>Email (private)</dt><dd><a href={`mailto:${review.email}`}>{review.email}</a></dd></div>
              <div><dt>Bought from</dt><dd>{review.purchase_location || 'Not given'}</dd></div>
              <div><dt>Submitted</dt><dd>{formatDate(review.created_at)}</dd></div>
              {review.moderated_at && <div><dt>Last moderated</dt><dd>{formatDate(review.moderated_at)} by {review.moderated_by}</dd></div>}
            </dl>
            <div className="card-actions">
              {review.status !== 'approved' && <button className="member-button" type="button" disabled={busy === review.id} onClick={() => setStatus(review.id, 'approved')}>Approve and publish</button>}
              {review.status === 'approved' && <button className="member-button secondary" type="button" disabled={busy === review.id} onClick={() => setStatus(review.id, 'removed')}>Remove from site</button>}
              {review.status !== 'rejected' && review.status !== 'approved' && <button className="member-button secondary" type="button" disabled={busy === review.id} onClick={() => setStatus(review.id, 'rejected')}>Reject (spam or abuse)</button>}
              {review.status !== 'pending' && <button className="text-button" type="button" disabled={busy === review.id} onClick={() => setStatus(review.id, 'pending')}>Move back to awaiting review</button>}
              {review.status === 'rejected' && <button className="text-button danger-text" type="button" disabled={busy === review.id} onClick={() => remove(review.id)}>Delete permanently</button>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
