import { useState } from 'react';

// The image URL is only readable by the signed-in owner; `version` busts the private cache after a change.
// Members without a photo see the UB symbol as their placeholder.
export default function MemberAvatar({ name, version, size = 'md' }) {
  const [failed, setFailed] = useState('');
  const showImage = version && failed !== version;
  return (
    <span className={`member-avatar member-avatar-${size}${showImage ? '' : ' member-avatar--placeholder'}`} aria-hidden={!showImage}>
      {showImage
        // Private, owner-only image: it cannot go through the public image CDN.
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={`/api/member/avatar?v=${encodeURIComponent(version)}`} alt={`Profile picture of ${name}`} onError={() => setFailed(version)} />
        // eslint-disable-next-line @next/next/no-img-element
        : <img src="/images/brand/ub-symbol.png" alt="" className="member-avatar__ub" />}
    </span>
  );
}
