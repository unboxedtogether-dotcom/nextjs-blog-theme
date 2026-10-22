import { useState } from 'react';

const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'U';

// The image URL is only readable by the signed-in owner; `version` busts the private cache after a change.
export default function MemberAvatar({ name, version, size = 'md' }) {
  const [failed, setFailed] = useState('');
  const showImage = version && failed !== version;
  return (
    <span className={`member-avatar member-avatar-${size}`} aria-hidden={!showImage}>
      {showImage
        // Private, owner-only image: it cannot go through the public image CDN.
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={`/api/member/avatar?v=${encodeURIComponent(version)}`} alt={`Profile picture of ${name}`} onError={() => setFailed(version)} />
        : <span>{initials(name)}</span>}
    </span>
  );
}
