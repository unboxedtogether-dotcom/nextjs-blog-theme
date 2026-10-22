const upcoming = [
  { title: '30-Day Barcode Challenge', text: 'A simple daily rhythm for looking past the front of the packet.' },
  { title: 'Food and drink journal', text: 'Note what you eat and drink, and how you feel afterwards.' },
  { title: 'Sleep and mood tracking', text: 'Gently notice patterns in your sleep, energy and mood.' },
  { title: 'Weekly and monthly progress comparisons', text: 'Look back on your starting point and see what has changed.' },
];

export default function ProgressComingSoon() {
  return (
    <section className="dashboard-card progress-card" aria-labelledby="progress-heading">
      <span>My progress</span>
      <h2 id="progress-heading">Coming Soon</h2>
      <p>We are building tools to help you notice your own patterns over time. They will appear here when they are ready.</p>
      <ul className="upcoming-list">
        {upcoming.map((item) => <li key={item.title}><div><strong>{item.title}</strong><p>{item.text}</p></div><span className="coming-soon">Coming Soon</span></li>)}
      </ul>
    </section>
  );
}
