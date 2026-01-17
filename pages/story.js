import Link from 'next/link';
import Layout from '../components/Layout';
import SEO from '../components/SEO';
import { siteConfig } from '../utils/site-config';

export default function Story() {
  return (
    <Layout>
      <SEO
        title={siteConfig.seo.story.title}
        description={siteConfig.seo.story.description}
      />

      {/* Hero Section */}
      <section className="bg-[#1e3a5f] text-white py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">My Story</h1>
          <p className="text-xl text-gray-200">
            The journey behind Unboxed Together
          </p>
        </div>
      </section>

      {/* Story Content */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-12">
            <p className="text-yellow-700 font-medium">Full story coming soon.</p>
          </div>

          {/* My Journey */}
          <div className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-[#1e3a5f] mb-6">
              My journey
            </h2>
            <div className="prose prose-lg text-gray-600">
              <p>
                [Placeholder paragraph: Share your personal journey here. What led you to start looking into food additives? What was your life like before this awareness?]
              </p>
            </div>
          </div>

          {/* The Turning Point */}
          <div className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-[#1e3a5f] mb-6">
              The turning point
            </h2>
            <div className="prose prose-lg text-gray-600">
              <p>
                [Placeholder paragraph: Describe the moment or experience that changed everything. What made you realise something needed to change? What was the catalyst?]
              </p>
            </div>
          </div>

          {/* Why I Wrote the Book */}
          <div className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-[#1e3a5f] mb-6">
              Why I wrote Unboxed – The Dirty Secret Hiding In Our Diet
            </h2>
            <div className="prose prose-lg text-gray-600">
              <p>
                [Placeholder paragraph: Explain your motivation for writing the book. What message did you want to share? Who did you write it for?]
              </p>
            </div>
          </div>

          {/* Why Unboxed Together */}
          <div className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-[#1e3a5f] mb-6">
              Why Unboxed Together
            </h2>
            <div className="prose prose-lg text-gray-600">
              <p>
                [Placeholder paragraph: Share the vision behind the app. Why did you decide to build this? How does it connect to your mission and the book?]
              </p>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-12 pt-8 border-t border-gray-200">
            <Link
              href="/book"
              className="btn btn-primary text-center"
            >
              Buy the book
            </Link>
            <Link
              href="/#signup"
              className="btn btn-outline text-center"
            >
              Join early testers
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
