import Layout from '../components/Layout';
import SEO from '../components/SEO';
import { siteConfig } from '../utils/site-config';

export default function Brainz() {
  return (
    <Layout>
      <SEO
        title={siteConfig.seo.brainz.title}
        description={siteConfig.seo.brainz.description}
      />

      {/* Hero Section */}
      <section className="bg-[#4b39ef] text-white py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Brainz Magazine
          </h1>
          <p className="text-xl text-gray-100">
            Publications and features
          </p>
        </div>
      </section>

      {/* Executive Contributor Badge */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-block bg-white rounded-lg shadow-lg p-6 md:p-8">
            <div className="inline-block bg-[#4b39ef] text-white px-4 py-2 rounded-full text-sm font-semibold mb-4">
              Executive Contributor
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              {siteConfig.brainzContributor.name}
            </h2>
            <p className="text-[#4b39ef] font-medium">
              {siteConfig.brainzContributor.award}
            </p>
          </div>
        </div>
      </section>

      {/* Articles Grid */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-[#4b39ef] text-center mb-12">
            Featured Articles
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {siteConfig.brainzArticles.map((article, index) => (
              <article
                key={index}
                className="bg-gray-50 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow"
              >
                <div className="p-6">
                  <h3 className="text-xl font-bold text-[#4b39ef] mb-3">
                    {article.title}
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {article.excerpt}
                  </p>
                  <a
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block btn btn-primary text-sm"
                  >
                    Read article
                  </a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Press / Media CTA */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-[#4b39ef] mb-6">
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
