import { useRef, useState } from 'react';
import { updateUser } from '@netlify/identity';
import FormMessage from '../auth/FormMessage';
import { useAuth } from '../auth/AuthProvider';
import MemberAvatar from './MemberAvatar';
import { avatarMaxBytes, bioLimit } from '../../utils/member-options.mjs';
import { questionnaireSections } from '../../utils/welcome-questionnaire.mjs';

const reasonOptions = questionnaireSections[0].blocks.find((block) => block.number === 6).fields[0].options;
const avatarPixels = 512;

// Crops to a square and re-encodes in the browser. This keeps uploads small and
// strips photo metadata such as location before anything leaves the device.
function prepareAvatar(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const side = Math.min(image.naturalWidth, image.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = avatarPixels;
      canvas.height = avatarPixels;
      canvas.getContext('2d').drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, avatarPixels, avatarPixels);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('This image could not be prepared.'))), 'image/jpeg', 0.88);
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This file could not be read as an image. Please choose a JPG, PNG or WebP photo.')); };
    image.src = url;
  });
}

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

export function AvatarControls({ name, version, onChange }) {
  const input = useRef(null);
  const { updateMember } = useAuth();
  // Keeps the header photo in step with the page.
  const changed = (nextVersion) => { onChange(nextVersion); updateMember({ avatarVersion: nextVersion }); };
  const [status, setStatus] = useState({ busy: false, error: '', success: '' });

  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setStatus({ busy: true, error: '', success: '' });
    try {
      const blob = await prepareAvatar(file);
      if (blob.size > avatarMaxBytes) throw new Error('Please choose an image under 2 MB.');
      const data = await readJson(await fetch('/api/member/avatar', { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: blob }));
      changed(data.avatarUpdatedAt || new Date().toISOString());
      setStatus({ busy: false, error: '', success: 'Your profile picture has been saved.' });
    } catch (error) {
      setStatus({ busy: false, error: error.message, success: '' });
    }
  };
  const remove = async () => {
    setStatus({ busy: true, error: '', success: '' });
    try {
      await readJson(await fetch('/api/member/avatar', { method: 'DELETE' }));
      changed(null);
      setStatus({ busy: false, error: '', success: 'Your profile picture has been removed.' });
    } catch (error) {
      setStatus({ busy: false, error: error.message, success: '' });
    }
  };

  return (
    <div className="avatar-controls">
      <MemberAvatar name={name} version={version} size="lg" />
      <div>
        <p className="avatar-help">A square photo works best. Only you can see your picture for now.</p>
        <input ref={input} type="file" accept="image/*" className="sr-only" id="avatar-upload" onChange={upload} />
        <div className="avatar-buttons">
          <button className="member-button secondary" type="button" disabled={status.busy} onClick={() => input.current?.click()}>{status.busy ? 'Saving…' : version ? 'Change picture' : 'Upload picture'}</button>
          {version && <button className="text-button danger" type="button" disabled={status.busy} onClick={remove}>Remove picture</button>}
        </div>
        <FormMessage error={status.error} success={status.success} />
      </div>
    </div>
  );
}

export default function ProfileEditor({ profile, about, onSaved, onCancel }) {
  const [form, setForm] = useState({
    displayName: profile.display_name,
    bio: profile.bio || '',
    interests: about.interests,
    reasons: about.reasons,
    town: about.town,
    phone: about.phone,
  });
  const [status, setStatus] = useState({ busy: false, error: '', success: '' });
  const { updateMember } = useAuth();
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const toggleReason = (reason) => setForm((current) => ({
    ...current,
    reasons: current.reasons.includes(reason) ? current.reasons.filter((item) => item !== reason) : [...current.reasons, reason],
  }));

  const save = async (event) => {
    event.preventDefault();
    if (!form.displayName.trim()) return setStatus({ busy: false, error: 'Please enter your name.', success: '' });
    setStatus({ busy: true, error: '', success: '' });
    try {
      await readJson(await fetch('/api/member', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile: form }) }));
      if (form.displayName.trim() !== profile.display_name) await updateUser({ data: { full_name: form.displayName.trim() } }).catch(() => {});
      updateMember({ name: form.displayName.trim() });
      setStatus({ busy: false, error: '', success: 'Your profile has been saved.' });
      onSaved?.({
        profile: { ...profile, display_name: form.displayName.trim(), bio: form.bio.trim() },
        about: { interests: form.interests.trim(), reasons: form.reasons, town: form.town.trim(), phone: form.phone.trim() },
      });
    } catch (error) {
      setStatus({ busy: false, error: error.message, success: '' });
    }
    return undefined;
  };

  return (
    <form className="profile-editor" onSubmit={save}>
      <div className="profile-editor-grid">
        <div className="profile-field">
          <label htmlFor="pe-name">Display name</label>
          <input id="pe-name" value={form.displayName} onChange={set('displayName')} maxLength={80} autoComplete="name" required />
        </div>
        <div className="profile-field">
          <label htmlFor="pe-town">Town or general area <span>Optional</span></label>
          <input id="pe-town" value={form.town} onChange={set('town')} maxLength={300} autoComplete="address-level2" />
        </div>
        <div className="profile-field is-wide">
          <label htmlFor="pe-bio">About me <span>Optional</span></label>
          <textarea id="pe-bio" value={form.bio} onChange={set('bio')} maxLength={bioLimit} rows={4} placeholder="A few words about you, your household or what you are working on." />
          <small>{form.bio.length} / {bioLimit}</small>
        </div>
        <div className="profile-field is-wide">
          <label htmlFor="pe-interests">What do you enjoy doing or talking about? <span>Optional</span></label>
          <input id="pe-interests" value={form.interests} onChange={set('interests')} maxLength={300} />
        </div>
        <fieldset className="profile-field is-wide">
          <legend>What brings you here? <span>Optional</span></legend>
          <div className="profile-chips">
            {reasonOptions.map((reason) => {
              const selected = form.reasons.includes(reason);
              return <button key={reason} type="button" className={`profile-chip${selected ? ' is-selected' : ''}`} aria-pressed={selected} onClick={() => toggleReason(reason)}>{reason}</button>;
            })}
          </div>
        </fieldset>
        <div className="profile-field">
          <label htmlFor="pe-phone">Phone number <span>Optional</span></label>
          <input id="pe-phone" type="tel" value={form.phone} onChange={set('phone')} maxLength={40} autoComplete="tel" />
        </div>
      </div>
      <p className="profile-editor-note">Your interests, reasons and contact details are the same answers you gave on page 1 of your welcome questionnaire, so changing them here updates them there too.</p>
      <FormMessage error={status.error} success={status.success} />
      <div className="profile-editor-actions">
        <button className="member-button" type="submit" disabled={status.busy}>{status.busy ? 'Saving…' : 'Save my profile'}</button>
        {onCancel && <button className="text-button" type="button" onClick={onCancel}>Close</button>}
      </div>
    </form>
  );
}
