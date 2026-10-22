import Link from 'next/link';
import { siteConfig } from '../utils/site-config';
import BrandLogo from './BrandLogo';
import SocialLinks from './SocialLinks';

const quickLinks = [
  ['/', 'Home'],
  ['/additives', 'Food Database'],
  ['/book', 'The Book'],
  ['/story', 'My Story'],
  ['/community', 'Community'],
  ['/barcode-challenge', '30-Day Barcode Challenge'],
  ['/brainz', 'Brainz Magazine'],
  ['/socials', 'Socials'],
];

const memberLinks = [
  ['/signup', 'Join for free'],
  ['/login', 'Log in'],
  ['/members', 'Member dashboard'],
];

export default function Footer() {
  return (
    <footer id="footer" className="site-footer">
      <div className="site-container">
        <div className="footer-grid">
          <div className="footer-brand">
            <BrandLogo className="footer-logo" />
            <p className="footer-tagline">{siteConfig.brandDescription}</p>
            <p>Unboxed Together helps people understand what is in their food, explore their own wellbeing and connect with a supportive community.</p>
            <a className="footer-book" href={siteConfig.bookLinks.ingramSpark} target="_blank" rel="noopener noreferrer">
              Buy the book direct<span className="sr-only"> (opens IngramSpark in a new tab)</span><span aria-hidden="true"> ↗</span>
            </a>
          </div>

          <nav className="footer-column" aria-label="Footer quick links">
            <h2>Explore</h2>
            <ul>{quickLinks.map(([href, label]) => <li key={href}><Link href={href}>{label}</Link></li>)}</ul>
          </nav>

          <nav className="footer-column" aria-label="Member links">
            <h2>Members</h2>
            <ul>{memberLinks.map(([href, label]) => <li key={href}><Link href={href}>{label}</Link></li>)}</ul>
          </nav>

          <div className="footer-column">
            <h2>Contact</h2>
            <ul>
              <li><a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a></li>
              <li><span className="footer-label">Media enquiries</span><a href={`mailto:${siteConfig.mediaEmail}`}>{siteConfig.mediaEmail}</a></li>
            </ul>
            <SocialLinks className="footer-socials" />
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} {siteConfig.companyName}. All rights reserved.</p>
          <p className="footer-disclaimer">{siteConfig.disclaimer}</p>
          <div className="footer-legal"><Link href="/privacy">Privacy Notice</Link><Link href="/terms">Terms and Conditions</Link></div>
        </div>
      </div>
    </footer>
  );
}
