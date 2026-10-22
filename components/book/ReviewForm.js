import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../auth/AuthProvider';
import FormMessage from '../auth/FormMessage';

const emptyForm = { name: '', email: '', rating: 0, headline: '', review: '', purchaseLocation: '', consent: false, website: '' };

// Reviews from members and non-members. Nothing is published until a moderator approves it.
export default function ReviewForm() {
  const { user, member } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [startedAt, setStartedAt] = useState(0);
  const [status, setStatus] = useState({ busy: false, error: '', done: '' });

  useEffect(() => { setStartedAt(Date.now()); }, []);
  useEffect(() => {
    if (!user) return;
    setForm((current) => ({ ...current, name: current.name || member?.name || user.name || '', email: current.email || user.email || '' }));
  }, [user, member]);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!form.rating) return setStatus({ busy: false, error: 'Please choose a star rating from 1 to 5.', done: '' });
    if (!form.consent) return setStatus({ busy: false, error: 'Please tick the box to agree to your review and display name being published.', done: '' });
    setStatus({ busy: true, error: '', done: '' });
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, rating: Number(form.rating), startedAt }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Your review could not be sent. Please try again.');
      setStatus({ busy: false, error: '', done: data.message });
      setForm(emptyForm);
    } catch (error) {
      setStatus({ busy: false, error: error.message, done: '' });
    }
    return undefined;
  };

  if (status.done) {
    return <div className="review-thanks" role="status"><p>{status.done}</p></div>;
  }

  return (
    <form className="review-form" onSubmit={submit} noValidate={false}>
      <div className="review-form__grid">
        <div className="field">
          <label htmlFor="rv-name">Name or display name</label>
          <input id="rv-name" value={form.name} onChange={set('name')} maxLength={80} autoComplete="name" required />
          <p className="field-hint">Shown with your review.</p>
        </div>
        <div className="field">
          <label htmlFor="rv-email">Email address</label>
          <input id="rv-email" type="email" value={form.email} onChange={set('email')} maxLength={254} autoComplete="email" required />
          <p className="field-hint">Private. Never shown publicly; only used if we need to contact you about your review.</p>
        </div>
      </div>

      <fieldset className="field star-input">
        <legend>Your rating</legend>
        <div className="star-input__options">
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value} className={Number(form.rating) >= value ? 'is-on' : ''}>
              <input type="radio" name="rating" value={value} checked={Number(form.rating) === value} onChange={set('rating')} required />
              <span aria-hidden="true">★</span>
              <span className="sr-only">{value} {value === 1 ? 'star' : 'stars'}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="rv-headline">Review headline</label>
        <input id="rv-headline" value={form.headline} onChange={set('headline')} maxLength={120} required />
      </div>
      <div className="field">
        <label htmlFor="rv-review">Your review</label>
        <textarea id="rv-review" value={form.review} onChange={set('review')} rows={6} minLength={10} maxLength={5000} required />
      </div>
      <div className="field">
        <label htmlFor="rv-purchase">Where did you purchase the book? <span className="optional">Optional</span></label>
        <input id="rv-purchase" value={form.purchaseLocation} onChange={set('purchaseLocation')} maxLength={120} placeholder="For example IngramSpark, Amazon, Waterstones or a local bookshop" />
      </div>

      {/* Honeypot: hidden from people, tempting to bots. */}
      <div className="review-form__hp" aria-hidden="true">
        <label htmlFor="rv-website">Leave this empty</label>
        <input id="rv-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
      </div>

      <label className="check-row review-consent">
        <input type="checkbox" checked={form.consent} onChange={set('consent')} required />
        <span>I agree to Unboxed Together publishing my review, star rating and display name on this website. My email address will not be published. See our <Link href="/privacy">Privacy Notice</Link>.</span>
      </label>

      <FormMessage error={status.error} />
      <button className="book-btn book-btn--primary" type="submit" disabled={status.busy}>{status.busy ? 'Sending…' : 'Submit my review'}</button>
      <p className="field-hint">Every review is checked before it appears. We publish genuine positive and negative feedback and never edit what you write.</p>
    </form>
  );
}
