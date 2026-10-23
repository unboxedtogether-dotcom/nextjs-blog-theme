const upcoming = [
  { title: '30-Day Barcode Challenge', text: 'A simple daily rhythm for looking past the front of the packet.' },
  { title: 'Food journal', text: 'Note what you eat, and how you feel afterwards.' },
  { title: 'Drink tracking', text: 'Keep track of what you drink through the day.' },
];

export default function ProgressComingSoon() {
  return (
    <section className="dashboard-card progress-card" aria-labelledby="more-tools-heading">
      <span>More tools</span>
      <h2 id="more-tools-heading">Coming Soon</h2>
      <p>More tools to help you notice your own patterns are on the way. They will appear here when they are ready.</p>
      <ul className="upcoming-list">
        {upcoming.map((item) => <li key={item.title}><div><strong>{item.title}</strong><p>{item.text}</p></div><span className="coming-soon">Coming Soon</span></li>)}
      </ul>
    </section>
  );
}
