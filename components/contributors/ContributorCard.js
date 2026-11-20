import Link from 'next/link';
import ContributorPhoto from './ContributorPhoto';

export default function ContributorCard({ person, photo, headingLevel = 'h3', photoPosition }) {
  const Heading = headingLevel;
  return (
    <article className="contributor-card">
      <ContributorPhoto photo={photo} sizes="(max-width: 760px) 100vw, 34rem" className="contributor-card__photo" position={photoPosition} />
      <div className="contributor-card__body">
        <span className="contributor-badge">{person.designation}</span>
        <Heading>{person.name}</Heading>
        <p className="contributor-card__title">{person.title}</p>
        <p>{person.shortIntro}</p>
        {person.award && <p className="contributor-card__award">{person.award}</p>}
        <div className="contributor-card__actions">
          <Link href={person.profilePath} className="ut-btn ut-btn--primary">{person.profileLabel || `Meet ${person.name.split(' ')[0]}`}</Link>
          <a href={person.brainzProfileUrl} target="_blank" rel="noopener noreferrer" className="ut-btn ut-btn--secondary">
            Brainz profile<span className="sr-only"> for {person.name} (opens in a new tab)</span><span aria-hidden="true"> ↗</span>
          </a>
        </div>
      </div>
    </article>
  );
}
