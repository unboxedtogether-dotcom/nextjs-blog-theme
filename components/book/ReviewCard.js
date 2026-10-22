import Stars from './Stars';

const formatDate = (value) => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export default function ReviewCard({ review }) {
  const details = [review.edition && `${review.edition} edition`, review.source && `Reviewed on ${review.source}`].filter(Boolean);
  return (
    <article className="review-card">
      <Stars rating={review.rating} />
      <h3>{review.headline}</h3>
      <blockquote><p>“{review.text}”</p></blockquote>
      <footer>
        <strong>{review.name}</strong>
        {review.verifiedPurchase && <span className="review-badge">Verified Purchase</span>}
        {details.length > 0 && <span className="review-meta">{details.join(' · ')}</span>}
        {review.date && <time dateTime={review.date}>{formatDate(review.date)}</time>}
      </footer>
    </article>
  );
}
