import Link from 'next/link';
import Layout from '../components/Layout';
import SEO from '../components/SEO';
import ArticleCard from '../components/contributors/ArticleCard';
import ContributorPhoto from '../components/contributors/ContributorPhoto';
import { founderProfiles, lee, trisha, trishaPhotos } from '../utils/contributors';
import { resolvePhotos } from '../utils/public-image';
import { siteConfig } from '../utils/site-config';

// Simple line icons in the site's blue, one per area of interest.
const icons = {
  nervous: <><path d="M12 3v18" /><path d="M12 8c-2.5 0-4-1.5-5-3.5M12 8c2.5 0 4-1.5 5-3.5M12 13c-3 0-5-1.5-6.5-4M12 13c3 0 5-1.5 6.5-4M12 18c-2 0-3.5-1-4.5-2.5M12 18c2 0 3.5-1 4.5-2.5" /></>,
  nutrition: <><path d="M12 21c-4.5 0-7-3.5-7-8 0-3.5 2.5-6 5-6 1 0 1.5.4 2 .4s1-.4 2-.4c2.5 0 5 2.5 5 6 0 4.5-2.5 8-7 8z" /><path d="M12 7.4c0-2 1-3.6 3-4.4" /></>,
  recovery: <><path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.7" /><path d="M20 4v4.7h-4.7" /><path d="M20 12a8 8 0 0 1-13.7 5.6L4 15.3" /><path d="M4 20v-4.7h4.7" /></>,
  environment: <><path d="M3 20h18" /><path d="M7 20V10l5-4 5 4v10" /><path d="M10.5 20v-4.5h3V20" /><circle cx="18.5" cy="5" r="1.8" /></>,
  cell: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="11" r="3" /><circle cx="7.6" cy="15.4" r="1" /><circle cx="16.6" cy="14.6" r="1.2" /><circle cx="15.5" cy="7" r=".9" /></>,
  travel: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17" /><path d="M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.2-3.6-8.5S9.6 5.9 12 3.5z" /></>,
};

function InterestIcon({ name }) {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icons[name]}
    </svg>
  );
}

function FounderProfile({ profile, photo, position }) {
  return (
    <article className="duo__person">
      <ContributorPhoto photo={photo} sizes="(max-width: 760px) 100vw, 28rem" position={position} />
      <div className="duo__body">
        <h3>{profile.name}</h3>
        <p className="duo__title">
          {profile.title.map((part, index) => (
            <span key={part}>{index > 0 && <span className="duo__sep" aria-hidden="true">|</span>}{part}</span>
          ))}
        </p>
        <p className="duo__bio">{profile.bio}</p>
      </div>
    </article>
  );
}

export default function TrishaBritton({ photos }) {
  return (
    <Layout>
      <SEO title={siteConfig.seo.trishaBritton.title} description={siteConfig.seo.trishaBritton.description} path={trisha.profilePath} />

      <div className="profile-page">
        {/* Hero */}
        <section className="profile-hero" aria-labelledby="profile-title">
          <div className="story-wrap profile-hero__grid">
            <div className="profile-hero__copy">
              <span className="contributor-badge">{trisha.designation}</span>
              <h1 id="profile-title">Meet {trisha.displayName}</h1>
              <p className="profile-hero__subtitle">{trisha.title}</p>
              <blockquote className="profile-hero__quote">
                <p>&ldquo;{trisha.introQuote}&rdquo;</p>
              </blockquote>
              <p className="profile-hero__intro">{trisha.intro}</p>
              <div className="button-row">
                <a href="#trisha-articles" className="ut-btn ut-btn--primary">Read Trisha&rsquo;s articles</a>
                <a href="#about-trisha" className="ut-btn ut-btn--secondary">About Trisha</a>
              </div>
            </div>
            <ContributorPhoto photo={photos.portrait} sizes="(max-width: 760px) 100vw, 28rem" priority className="profile-hero__photo" />
          </div>
        </section>

        {/* About */}
        <section id="about-trisha" className="story-chapter" aria-labelledby="about-title">
          <div className="story-wrap story-split story-split--photo-left story-split--small-media">
            <div className="story-split__media">
              <ContributorPhoto photo={photos.about} sizes="(max-width: 760px) 100vw, 26rem" className="profile-about__photo" />
            </div>
            <div className="story-split__text story-text">
              <header className="story-chapter__heading">
                <p className="story-chapter__number">About Trisha</p>
                <h2 id="about-title">A Different Perspective. A Shared Understanding.</h2>
              </header>
              {trisha.about.map((paragraph, index) => (
                <p key={paragraph} className={index === 0 ? 'story-strong' : undefined}>{paragraph}</p>
              ))}
            </div>
          </div>
        </section>

        {/* Areas of interest */}
        <section className="story-chapter story-chapter--quiet" aria-labelledby="interests-title">
          <div className="story-wrap">
            <header className="story-chapter__heading profile-section-heading">
              <p className="story-chapter__number">Areas of interest &amp; expertise</p>
              <h2 id="interests-title">Where Trisha&rsquo;s work focuses</h2>
            </header>
            <ul className="interest-grid">
              {trisha.interests.map((item) => (
                <li key={item.title} className="interest-card">
                  <span className="ut-card__icon"><InterestIcon name={item.icon} /></span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Shared perspective — Founder and Co-Founder */}
        <section className="story-chapter" aria-labelledby="shared-title">
          <div className="story-wrap">
            <div className="founders-intro story-text">
              <header className="story-chapter__heading">
                <p className="story-chapter__number">Our shared perspective</p>
                <h2 id="shared-title">Two Perspectives. One Shared Understanding.</h2>
              </header>
              {founderProfiles.intro.map((paragraph, index) => (
                <p key={paragraph} className={index === 0 ? 'story-opening' : index === founderProfiles.intro.length - 1 ? 'story-emphasis' : undefined}>{paragraph}</p>
              ))}
            </div>
            <div className="duo">
              <FounderProfile profile={founderProfiles.lee} photo={lee.photo} position="50% 40%" />
              <span className="duo__link" aria-hidden="true">+</span>
              <FounderProfile profile={founderProfiles.trisha} photo={photos.portrait} />
            </div>
          </div>
        </section>

        {/* Articles */}
        <section id="trisha-articles" className="story-chapter story-chapter--quiet" aria-labelledby="articles-title">
          <div className="story-wrap">
            <header className="story-chapter__heading profile-section-heading">
              <p className="story-chapter__number">Executive Contributor at Brainz Magazine</p>
              <h2 id="articles-title">Trisha&rsquo;s Writing &amp; Insights</h2>
            </header>
            <div className="article-grid">
              {trisha.articles.map((article) => <ArticleCard key={article.title} article={article} />)}
            </div>
            <div className="profile-centre">
              <a href={trisha.brainzProfileUrl} target="_blank" rel="noopener noreferrer" className="ut-btn ut-btn--primary">
                View Trisha&rsquo;s Brainz Magazine Profile<span className="sr-only"> (opens in a new tab)</span><span aria-hidden="true"> ↗</span>
              </a>
              <p className="profile-small"><Link href="/brainz" className="text-link">See all Unboxed Together contributors at Brainz Magazine</Link></p>
            </div>
          </div>
        </section>

        {/* Connection to Unboxed Together */}
        <section className="story-invite" aria-labelledby="together-title">
          <div className="story-wrap story-narrow">
            <h2 id="together-title">Understanding More. Together.</h2>
            <p>Unboxed Together was built around a simple idea: the more we understand about the influences affecting our everyday lives, the better equipped we become to make informed choices.</p>
            <p>Nutrition is an important part of that understanding, but it isn&rsquo;t the whole picture.</p>
            <p>Sleep, stress, our surroundings, our routines and the way our nervous system responds to daily life all deserve attention.</p>
            <p className="story-strong">By bringing different experiences and perspectives together, we can explore these connections and help others begin recognising patterns in their own lives.</p>
            <div className="story-actions story-actions--invite">
              <Link href="/community" className="ut-btn ut-btn--primary">Explore Our Community</Link>
            </div>
            <p className="profile-disclaimer">
              Content on Unboxed Together is educational and not medical advice.
            </p>
          </div>
        </section>
      </div>
    </Layout>
  );
}

export async function getStaticProps() {
  const photos = resolvePhotos('images/trisha', trishaPhotos);
  for (const photo of Object.values(photos)) {
    if (!photo.src && photo.fallback) photo.src = photos[photo.fallback]?.src || null;
  }
  return { props: { photos } };
}
