import Image from 'next/image';

// Fills its frame with a photo, or shows a labelled placeholder until one is uploaded.
export default function ContributorPhoto({ photo, sizes, priority = false, className = '', position }) {
  if (!photo?.src) {
    return (
      <div className={`contributor-photo contributor-photo--empty ${className}`} role="img" aria-label={`${photo?.alt || 'Photo'} (coming soon)`}>
        <svg viewBox="0 0 64 64" aria-hidden="true" width="56" height="56">
          <circle cx="32" cy="24" r="11" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <path d="M12 54c3-11 11-17 20-17s17 6 20 17" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <span>Photo coming soon</span>
      </div>
    );
  }
  return (
    <div className={`contributor-photo ${className}`}>
      <Image src={photo.src} alt={photo.alt} fill sizes={sizes} priority={priority} style={position ? { objectPosition: position } : undefined} />
    </div>
  );
}
