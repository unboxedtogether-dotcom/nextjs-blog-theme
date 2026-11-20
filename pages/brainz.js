import Link from 'next/link';
import Layout from '../components/Layout';
import SEO from '../components/SEO';
import ArticleCard from '../components/contributors/ArticleCard';
import ContributorCard from '../components/contributors/ContributorCard';
import { lee, trisha, trishaPhotos } from '../utils/contributors';
import { findPublicImage } from '../utils/public-image';
import { siteConfig } from '../utils/site-config';

export default function Brainz({ trishaPhoto }) {
  return (
    <Layout>
      <SEO
        title={siteConfig.seo.brainz.title}
        description={siteConfig.seo.brainz.description}
        path="/brainz"
      />

      {/* Hero Section */}
      <section className="bg-[var(--brand-blue)] text-white py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Brainz Magazine
          </h1>
          <p className="text-xl text-gray-100">
            Publications and features from Lee Jones and Trisha Britton, RN
          </p>
        </div>
      </section>

      {/* Executive Contributors — Lee and Trisha, equally featured */}
      <section className="py-16 md:py-20 bg-gray-50" aria-labelledby="contributors-title">
        <div className="site-container">
          <div className="ut-section__heading">
            <p className="ut-kicker">Executive Contributors</p>
            <h2 id="contributors-title">Our people at Brainz Magazine</h2>
            <p>Two perspectives, one shared interest in the influences that shape how we think, feel and function.</p>
          </div>
          <div className="contributor-grid">
            <ContributorCard person={lee} photo={lee.photo} photoPosition="50% 40%" />
            <ContributorCard person={trisha} photo={trishaPhoto} />
          </div>
        </div>
      </section>

      {lee.articles.length > 0 && (
        <section className="py-16 md:py-24 bg-white" aria-labelledby="lee-articles-title">
          <div className="site-container">
            <div className="ut-section__heading">
              <p className="ut-kicker">Lee Jones · Executive Contributor</p>
              <h2 id="lee-articles-title">Lee&rsquo;s Featured Articles</h2>
            </div>
            <div className="article-grid">
              {lee.articles.map((article) => <ArticleCard key={article.link} article={article} />)}
            </div>
          </div>
        </section>
      )}

      {trisha.articles.length > 0 && (
        <section className="py-16 md:py-24 bg-gray-50" aria-labelledby="trisha-articles-title">
          <div className="site-container">
            <div className="ut-section__heading">
              <p className="ut-kicker">Trisha Britton, RN · Executive Contributor</p>
              <h2 id="trisha-articles-title">Trisha&rsquo;s Writing &amp; Insights</h2>
            </div>
            <div className="article-grid">
              {trisha.articles.map((article) => <ArticleCard key={article.title} article={article} />)}
            </div>
            <div className="profile-centre">
              <Link href={trisha.profilePath} className="ut-btn ut-btn--secondary">Meet Trisha</Link>
            </div>
          </div>
        </section>
      )}

      {/* Press / Media CTA */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-[var(--brand-blue)] mb-6">
            Press / Media
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Interested in featuring Unboxed Together or discussing food additive awareness?
          </p>
          <a
            href={`mailto:${siteConfig.mediaEmail}`}
            className="btn btn-primary"
          >
            Contact for media
          </a>
        </div>
      </section>
    </Layout>
  );
}

export async function getStaticProps() {
  const { portrait } = trishaPhotos;
  return { props: { trishaPhoto: { ...portrait, src: findPublicImage('images/trisha', portrait.name) } } };
}
