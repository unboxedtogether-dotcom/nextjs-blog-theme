import { useEffect, useState } from 'react';
import FormMessage from '../auth/FormMessage';
import { messageTopics } from '../../utils/member-options.mjs';

const formatDate = (value) => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default function ContactForm({ email }) {
  const [form, setForm] = useState({ topic: messageTopics[0], message: '', replyEmail: email });
  const [sent, setSent] = useState([]);
  const [status, setStatus] = useState({ busy: false, error: '', success: '' });

  useEffect(() => {
    fetch('/api/member/messages').then((response) => (response.ok ? response.json() : { messages: [] })).then((data) => setSent(data.messages || [])).catch(() => {});
  }, []);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const send = async (event) => {
    event.preventDefault();
    if (!form.message.trim()) return setStatus({ busy: false, error: 'Please write your message.', success: '' });
    setStatus({ busy: true, error: '', success: '' });
    try {
      const response = await fetch('/api/member/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Your message could not be sent.');
      setSent((current) => [data.message, ...current]);
      setForm((current) => ({ ...current, message: '' }));
      setStatus({ busy: false, error: '', success: 'Thank you. Your message has been sent privately to Unboxed Together.' });
    } catch (error) {
      setStatus({ busy: false, error: error.message, success: '' });
    }
    return undefined;
  };

  return (
    <section className="dashboard-card contact-card" id="contact" aria-labelledby="contact-heading">
      <span>Contact Unboxed Together</span>
      <h2 id="contact-heading">Send us a private message</h2>
      <p>Your message goes straight to the Unboxed Together team and is only visible to you and us. If you would rather talk something through, just say so and we will get in touch.</p>
      <form className="contact-form" onSubmit={send}>
        <div className="profile-field">
          <label htmlFor="contact-topic">What is it about?</label>
          <select id="contact-topic" value={form.topic} onChange={set('topic')}>
            {messageTopics.map((topic) => <option key={topic}>{topic}</option>)}
          </select>
        </div>
        <div className="profile-field">
          <label htmlFor="contact-message">Your message</label>
          <textarea id="contact-message" value={form.message} onChange={set('message')} rows={5} maxLength={5000} required />
        </div>
        <div className="profile-field">
          <label htmlFor="contact-email">Email for our reply</label>
          <input id="contact-email" type="email" value={form.replyEmail} onChange={set('replyEmail')} maxLength={254} autoComplete="email" required />
        </div>
        <FormMessage error={status.error} success={status.success} />
        <button className="member-button" type="submit" disabled={status.busy}>{status.busy ? 'Sending…' : 'Send message'}</button>
      </form>
      {sent.length > 0 && (
        <details className="contact-history">
          <summary>Messages you have sent ({sent.length})</summary>
          <ul>{sent.map((item) => <li key={item.id}><strong>{item.topic}</strong> · {formatDate(item.created_at)}<p>{item.message}</p></li>)}</ul>
        </details>
      )}
    </section>
  );
}
