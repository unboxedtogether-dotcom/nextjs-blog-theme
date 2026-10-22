// Free Member is the only plan for now. No pricing, payments or paid restrictions.
export default function SubscriptionCard({ profile, compact = false }) {
  const plan = (profile.membership_tier_name || 'Free Member').toUpperCase();
  const status = profile.membership_status === 'active' ? 'Active' : profile.membership_status;
  const since = profile.membership_started_at || profile.created_at;
  return (
    <section className={`dashboard-card subscription-card${compact ? ' is-compact' : ''}`} aria-labelledby="subscription-heading">
      <span>My subscription</span>
      <h2 id="subscription-heading">Your membership</h2>
      <dl className="subscription-facts">
        <div><dt>Current Membership</dt><dd className="plan-badge">{plan}</dd></div>
        <div><dt>Membership Status</dt><dd><span className="status-dot" aria-hidden="true" />{status}</dd></div>
        <div><dt>Additional Membership Features</dt><dd><span className="coming-soon">COMING SOON</span></dd></div>
      </dl>
      <p>Your free membership gives you full access to the community, additive search and your welcome questionnaire. Optional membership upgrades and additional features will become available in the future. Nothing changes for you unless you choose to upgrade.</p>
      {since && <p className="subscription-since">Member since {new Date(since).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p>}
    </section>
  );
}
