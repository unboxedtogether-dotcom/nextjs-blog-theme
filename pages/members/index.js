import Link from 'next/link';
import Layout from '../../components/Layout';
import SEO from '../../components/SEO';
import { getBaseline, getMember } from '../../utils/member-server';

const pillarLabels = { general_wellbeing_score: 'Wellbeing', energy_score: 'Energy', focus_score: 'Focus', sleep_score: 'Sleep', digestion_score: 'Digestion' };

export default function Members({ profile, baseline }) {
  return <Layout><SEO title="My dashboard | Unboxed Together" description="Your private Unboxed Together member dashboard." path="/members" /><div className="member-page"><header className="member-hero"><p className="member-kicker">Your member space</p><h1>Welcome, {profile.display_name}.</h1><p>A calm place to understand ingredients and notice your own patterns over time.</p></header><div className="dashboard-grid"><Link className="dashboard-card dashboard-card-primary" href="/additives"><span>Start here</span><h2>Continue with additive search</h2><p>Search the full library and see complete Unboxed breakdowns.</p><strong>Open additive search →</strong></Link><section className="dashboard-card dashboard-baseline"><span>Your starting point</span><h2>The five pillars</h2><div className="pillar-list">{Object.entries(pillarLabels).map(([key, label]) => <div key={key}><div><strong>{label}</strong><span>{baseline?.[key] ?? '—'} / 5</span></div><div className="pillar-track"><span style={{ width: `${(baseline?.[key] || 0) * 20}%` }} /></div></div>)}</div><p className="dashboard-note">This is your own starting point, not a diagnosis or clinical score.</p></section><section className="dashboard-card"><span>Next step</span><h2>30-Day Barcode Challenge</h2><p>A simple daily rhythm for looking past the front of the packet.</p><span className="coming-soon">Coming soon</span></section><section className="dashboard-card"><span>Your library</span><h2>Saved items</h2><p>Keep useful additive records close when this feature arrives.</p><span className="coming-soon">Coming soon</span></section><section className="dashboard-card"><span>Look back gently</span><h2>Progress check-in</h2><p>Revisit the same pillars without turning them into medical scores.</p><span className="coming-soon">Coming soon</span></section><Link className="dashboard-card" href="/members/profile"><span>Account</span><h2>Profile and preferences</h2><p>Update your name, review answers, or manage your account.</p><strong>Open profile →</strong></Link></div></div></Layout>;
}

export async function getServerSideProps(context) {
  const member = await getMember();
  if (!member) return { redirect: { destination: `/login?next=${encodeURIComponent(context.resolvedUrl)}`, permanent: false } };
  if (!member.profile.onboarding_completed) return { redirect: { destination: '/onboarding', permanent: false } };
  const baseline = await getBaseline(member.user.id);
  return { props: { profile: member.profile, baseline: baseline ? JSON.parse(JSON.stringify(baseline)) : null } };
}
