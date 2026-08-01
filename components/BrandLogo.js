import Image from 'next/image';
import Link from 'next/link';
import { siteConfig } from '../utils/site-config';

export default function BrandLogo({ light = false, compact = false }) {
  return (
    <Link
      href="/"
      className={`brand-logo${light ? ' brand-logo--light' : ''}${compact ? ' brand-logo--compact' : ''}`}
      aria-label={`${siteConfig.siteName} home`}
    >
      <Image
        src={compact ? '/images/brand/ub-mark.png' : '/images/brand/unboxed-together-logo.png'}
        alt=""
        width={compact ? 109 : 177}
        height={compact ? 102 : 178}
        className="brand-logo__image"
        priority
      />
    </Link>
  );
}
