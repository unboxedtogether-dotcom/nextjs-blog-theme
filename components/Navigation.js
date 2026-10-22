import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { logout } from '@netlify/identity';
import { useAuth } from './auth/AuthProvider';
import BrandLogo from './BrandLogo';
import MemberAvatar from './members/MemberAvatar';
import SocialLinks from './SocialLinks';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/additives', label: 'Food Database' },
  { href: '/book', label: 'The Book' },
  { href: '/story', label: 'My Story' },
  { href: '/community', label: 'Community' },
  { href: '#footer', label: 'Contact' },
];

// Secondary pages kept one click away rather than removed.
const moreLinks = [
  { href: '/barcode-challenge', label: '30-Day Barcode Challenge' },
  { href: '/brainz', label: 'Brainz Magazine' },
  { href: '/socials', label: 'Socials' },
];

// Closes a dropdown on outside click or Escape.
function useDismiss(open, setOpen) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (event) => { if (ref.current && !ref.current.contains(event.target)) setOpen(false); };
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [open, setOpen]);
  return ref;
}

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const moreRef = useDismiss(moreOpen, setMoreOpen);
  const memberRef = useDismiss(memberOpen, setMemberOpen);
  const router = useRouter();
  const { user, loading, member } = useAuth();
  const memberName = member?.name || user?.name || user?.email?.split('@')[0] || 'My profile';

  useEffect(() => {
    const close = () => { setIsOpen(false); setMoreOpen(false); setMemberOpen(false); };
    router.events.on('routeChangeStart', close);
    return () => router.events.off('routeChangeStart', close);
  }, [router.events]);

  const signOut = async () => {
    setIsOpen(false);
    await logout();
    window.location.href = '/';
  };
  const current = (href) => (router.pathname === href ? 'page' : undefined);

  return (
    <header className="site-header">
      <nav className="site-nav" aria-label="Primary navigation">
        <BrandLogo responsive />

        <button
          type="button"
          className="nav-toggle"
          aria-expanded={isOpen}
          aria-controls="primary-menu"
          onClick={() => setIsOpen((open) => !open)}
        >
          <span className="sr-only">{isOpen ? 'Close menu' : 'Open menu'}</span>
          <span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />
        </button>

        <div id="primary-menu" className={`nav-panel${isOpen ? ' is-open' : ''}`}>
          <ul className="nav-links">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} aria-current={current(link.href)} onClick={() => setIsOpen(false)}>{link.label}</Link>
              </li>
            ))}
            <li className="nav-more" ref={moreRef}>
              <button type="button" aria-expanded={moreOpen} aria-controls="nav-more-menu" onClick={() => setMoreOpen((open) => !open)}>
                More <span aria-hidden="true" className="nav-caret" />
              </button>
              <ul id="nav-more-menu" className={`nav-dropdown${moreOpen ? ' is-open' : ''}`}>
                {moreLinks.map((link) => (
                  <li key={link.href}><Link href={link.href} aria-current={current(link.href)} onClick={() => { setMoreOpen(false); setIsOpen(false); }}>{link.label}</Link></li>
                ))}
              </ul>
            </li>
          </ul>

          <div className="nav-account" aria-label="Member account">
            {!loading && (user ? (
              <div className="nav-member" ref={memberRef}>
                <button type="button" className="nav-member__button" aria-expanded={memberOpen} aria-controls="nav-member-menu" onClick={() => setMemberOpen((open) => !open)}>
                  <MemberAvatar name={memberName} version={member?.avatarVersion} size="sm" />
                  <span className="nav-member__name">{memberName}</span>
                  <span aria-hidden="true" className="nav-caret" />
                </button>
                <ul id="nav-member-menu" className={`nav-dropdown nav-dropdown--right${memberOpen ? ' is-open' : ''}`}>
                  <li><Link href="/members" aria-current={current('/members')} onClick={() => setIsOpen(false)}>My Dashboard</Link></li>
                  <li><Link href="/members/profile" aria-current={current('/members/profile')} onClick={() => setIsOpen(false)}>My Profile</Link></li>
                  <li><button type="button" onClick={signOut}>Log Out</button></li>
                </ul>
              </div>
            ) : (
              <>
                <Link href="/login" className="nav-login" onClick={() => setIsOpen(false)}>Log in</Link>
                <Link className="nav-join" href="/signup" onClick={() => setIsOpen(false)}>Join free</Link>
              </>
            ))}
          </div>
          <SocialLinks className="nav-socials" />
        </div>
      </nav>
    </header>
  );
}
