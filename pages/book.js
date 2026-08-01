import Link from 'next/link';
import Layout from '../components/Layout';
import SEO from '../components/SEO';
import { siteConfig } from '../utils/site-config';

const bookStores = [
  { name: 'Direct from IngramSpark', url: siteConfig.bookLinks.ingramDirect },
  { name: 'Amazon UK', url: siteConfig.bookLinks.amazonUK },
  { name: 'Waterstones', url: siteConfig.bookLinks.waterstones },
  { name: 'Amazon Kindle', url: siteConfig.bookLinks.amazonKindle },
  { name: "Blackwell's", url: siteConfig.bookLinks.blackwells },
];

const reviewLinks = [
  { name: 'Read an Amazon review', url: siteConfig.bookLinks.amazonReview },
  { name: 'Read Waterstones reviews', url: siteConfig.bookLinks.waterstonesReviews },
  { name: 'Send feedback', url: `mailto:${siteConfig.email}` },
];

function StarRating({ count }) {
  return (
    <span className="text-yellow-500 text-xl">
      {'★'.repeat(count)}{'☆'.repeat(5 - count)}
    </span>
  );
}

export default function Book() {
  return (
    <Layout>
      <SEO
        title={siteConfig.seo.book.title}
        description={siteConfig.seo.book.description}
      />

      {/* Hero Section */}
      <section className="bg-[#4b39ef] text-white py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Unboxed — Buy the Book
          </h1>
          <p className="text-xl text-gray-100">
            {siteConfig.bookTitle}
          </p>
        </div>
      </section>

      {/* Where to Buy */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-[#4b39ef] text-center mb-8">
            Where to buy
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {bookStores.map((store) => (
              <a
                key={store.name}
                href={store.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary text-center"
              >
                {store.name}
              </a>
            ))}
          </div>
          <p className="text-center text-gray-500 mt-6 text-sm">
            Availability varies by region.
          </p>
        </div>
      </section>

      {/* Reviews and Feedback */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-[#4b39ef] text-center mb-8">
            Reviews and feedback
          </h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {reviewLinks.map((link) => (
              <a
                key={link.name}
                href={link.url}
                target={link.url.startsWith('mailto:') ? undefined : '_blank'}
                rel={link.url.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
                className="btn btn-outline text-center"
              >
                {link.name}
              </a>
            ))}
          </div>
        </div>
      </section>

      {siteConfig.customerReviews.length > 0 && (
        <section className="py-16 md:py-24 bg-white">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-[#4b39ef] text-center mb-12">
              What readers are saying
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {siteConfig.customerReviews.map((review) => (
                <div
                  key={`${review.name}-${review.text}`}
                  className="bg-gray-50 rounded-lg p-6 shadow-md"
                >
                  <StarRating count={review.stars} />
                  <p className="text-gray-600 mt-4 mb-4 italic">
                    "{review.text}"
                  </p>
                  <p className="text-sm text-gray-500">
                    — {review.name}, {review.country}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-16 md:py-24 bg-[#4b39ef]">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-6">
            Want to try the app?
          </h2>
          <p className="text-xl text-gray-100 mb-8">
            Join our early testers and be the first to know when the app launches.
          </p>
          <Link
            href="/#signup"
            className="btn bg-white text-[#4b39ef] hover:bg-gray-100 font-semibold"
          >
            Join early testers for the app
          </Link>
        </div>
      </section>
    </Layout>
  );
}
