// Loading indicator using the UB symbol.
export default function BrandLoader({ label = 'Loading…' }) {
  return (
    <div className="brand-loader" role="status">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/brand/ub-symbol.png" alt="" width={40} height={51} />
      <span>{label}</span>
    </div>
  );
}
