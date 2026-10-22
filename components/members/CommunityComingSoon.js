const upcoming = [
  { title: 'Group discussions', text: 'Talk things through with other members in a safe, supportive space.' },
  { title: 'Community activities', text: 'Take part in shared activities and challenges together.' },
  { title: 'App integration', text: 'Connect your member account with the Unboxed app.' },
];

// Placeholder only: no chat or community features are active yet.
export default function CommunityComingSoon() {
  return (
    <section className="dashboard-card progress-card" aria-labelledby="community-heading">
      <span>My community</span>
      <h2 id="community-heading">Coming Soon</h2>
      <p>Space to connect with other members is on its way. It will appear here when it is ready.</p>
      <ul className="upcoming-list">
        {upcoming.map((item) => <li key={item.title}><div><strong>{item.title}</strong><p>{item.text}</p></div><span className="coming-soon">Coming Soon</span></li>)}
      </ul>
    </section>
  );
}
