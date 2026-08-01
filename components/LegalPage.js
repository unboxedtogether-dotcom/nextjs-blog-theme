import Layout from './Layout';
import SEO from './SEO';

export default function LegalPage({ title, description, children, path }) {
  return <Layout><SEO title={`${title} | Unboxed Together`} description={description} path={path} /><article className="legal-page"><p className="member-kicker">Unboxed Together</p><h1>{title}</h1><p className="legal-updated">Last updated: 1 August 2026</p>{children}</article></Layout>;
}
