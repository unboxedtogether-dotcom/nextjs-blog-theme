import Image from 'next/image';

export default function ArticleCard({ article, author }) {
  return (
    <article className="article-card">
      {article.image && (
        <div className="article-card__media">
          <Image src={article.image.src} alt={article.image.alt} width={article.image.width} height={article.image.height} sizes="(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 36rem" />
        </div>
      )}
      <div className="article-card__body">
        <p className="article-card__meta">
          <span>Brainz Magazine</span>
          {article.label && <><span aria-hidden="true">·</span><span>{article.label}</span></>}
        </p>
        <h3>{article.title}</h3>
        {article.excerpt && <p>{article.excerpt}</p>}
        {author && <p className="article-card__author">By {author}</p>}
        {article.link ? (
          <a href={article.link} target="_blank" rel="noopener noreferrer" className="ut-btn ut-btn--secondary article-card__button">
            Read article<span className="sr-only">: {article.title} (opens Brainz Magazine in a new tab)</span><span aria-hidden="true"> ↗</span>
          </a>
        ) : (
          <span className="soon-badge article-card__placeholder">Link coming soon — add the verified URL</span>
        )}
      </div>
    </article>
  );
}
