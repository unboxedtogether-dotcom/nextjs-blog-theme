import Image from 'next/image';
import Link from 'next/link';
import { siteConfig } from '../utils/site-config';

// The three supplied logo files, trimmed of surrounding whitespace only.
export const brandAssets = {
  horizontal: { src: '/images/brand/unboxed-together-horizontal.png', width: 960, height: 646 },
  vertical: { src: '/images/brand/unboxed-together-vertical.png', width: 720, height: 1257 },
  symbol: { src: '/images/brand/ub-symbol.png', width: 480, height: 613 },
};

export function BrandImage({ variant = 'horizontal', className = '', alt = siteConfig.siteName, priority = false, sizes }) {
  const asset = brandAssets[variant];
  return <Image src={asset.src} alt={alt} width={asset.width} height={asset.height} className={className} priority={priority} sizes={sizes} />;
}

// Horizontal logo (UNBOXED left, TOGETHER right) at every screen size.
export default function BrandLogo({ className = '' }) {
  return (
    <Link href="/" className={`brand-logo ${className}`} aria-label={`${siteConfig.siteName} home`}>
      <BrandImage variant="horizontal" alt="" className="brand-logo__image" priority sizes="160px" />
    </Link>
  );
}
