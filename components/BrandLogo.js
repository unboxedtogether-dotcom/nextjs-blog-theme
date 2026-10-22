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

// Horizontal logo by default; on small screens `responsive` swaps to the UB symbol.
export default function BrandLogo({ responsive = false, className = '' }) {
  return (
    <Link href="/" className={`brand-logo${responsive ? ' brand-logo--responsive' : ''} ${className}`} aria-label={`${siteConfig.siteName} home`}>
      <BrandImage variant="horizontal" alt="" className="brand-logo__image brand-logo__full" priority sizes="160px" />
      {responsive && <BrandImage variant="symbol" alt="" className="brand-logo__image brand-logo__symbol" priority sizes="48px" />}
    </Link>
  );
}
