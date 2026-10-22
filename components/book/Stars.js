export default function Stars({ rating }) {
  return (
    <p className="stars" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((value) => <span key={value} aria-hidden="true" className={value <= rating ? 'is-on' : ''}>★</span>)}
    </p>
  );
}
