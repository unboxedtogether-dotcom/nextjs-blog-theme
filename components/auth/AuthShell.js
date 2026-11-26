import Link from 'next/link';
import BrandLogo from '../BrandLogo';

export default function AuthShell({ eyebrow, badge, title, intro, children, footer }) {
  return (
    <main className="auth-page" id="main-content">
      <div className="auth-atmosphere" aria-hidden="true" />
      <section className="auth-brand-panel">
        <BrandLogo />
        <div>
          {badge ? <p className="auth-free-badge">{badge}</p> : <p className="auth-eyebrow">{eyebrow}</p>}
          <h1>{title}</h1>
          <p>{intro}</p>
        </div>
        <p className="auth-note">Clearer food choices, without fear or judgement.</p>
      </section>
      <section className="auth-form-panel">
        <Link href="/home" className="auth-back">Back to Unboxed Together</Link>
        <div className="auth-card">
          {children}
          {footer && <div className="auth-footer">{footer}</div>}
        </div>
      </section>
    </main>
  );
}
