import { useState } from 'react';
import Layout from '../components/Layout';
import SEO from '../components/SEO';
import { siteConfig } from '../utils/site-config';

export default function Home() {
  const [formStatus, setFormStatus] = useState('idle');

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    setFormStatus('submitting');

    try {
      const formData = new FormData(event.target);
      const response = await fetch('/__forms.html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(formData).toString(),
      });

      if (response.ok) {
        setFormStatus('success');
        event.target.reset();
      } else {
        setFormStatus('error');
      }
    } catch (error) {
      setFormStatus('error');
    }
  };
  return (
    <Layout>
      <SEO
        title={siteConfig.seo.home.title}
        description={siteConfig.seo.home.description}
      />

      {/* Hero Section */}
      <section className="bg-[#4b39ef] text-white py-20 md:py-32">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            {siteConfig.siteName}
          </h1>
          <p className="text-xl md:text-2xl text-gray-100 mb-10 max-w-3xl mx-auto">
            We're building a simple barcode-scanning app to help people understand food additives and make clearer choices.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#signup"
              className="btn bg-white text-[#4b39ef] hover:bg-gray-100 font-semibold"
            >
              Join early testers
            </a>
            <a
              href="/additives"
              className="btn border-2 border-white text-white hover:bg-white hover:text-[#4b39ef] font-semibold"
            >
              Search additives
            </a>
          </div>
        </div>
      </section>

      {/* What It Does Section */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-[#4b39ef] mb-12">
            What it does
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="bg-white rounded-lg p-8 shadow-lg text-center">
              <div className="w-16 h-16 bg-[#4b39ef] rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-[#4b39ef] mb-4">Scan barcodes</h3>
              <p className="text-gray-600">
                Scan products in seconds and see what's really inside.
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-white rounded-lg p-8 shadow-lg text-center">
              <div className="w-16 h-16 bg-[#4b39ef] rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-[#4b39ef] mb-4">See additives clearly</h3>
              <p className="text-gray-600">
                Traffic-light clarity that explains what additives may be doing to you.
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-white rounded-lg p-8 shadow-lg text-center">
              <div className="w-16 h-16 bg-[#4b39ef] rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-[#4b39ef] mb-4">Track what works for you</h3>
              <p className="text-gray-600">
                Log what you eat and spot patterns in mood, focus, sleep, and gut.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Email Signup Section */}
      <section id="signup" className="py-16 md:py-24 bg-white">
        <div className="max-w-xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-[#4b39ef] mb-6">
            Get early access
          </h2>
          {formStatus === 'success' ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <p className="text-green-800 font-semibold">Thank you for signing up!</p>
              <p className="text-green-600 mt-2">We'll notify you when early access is available.</p>
            </div>
          ) : (
            <form
              name="early-access"
              onSubmit={handleFormSubmit}
              className="space-y-4"
            >
              <input type="hidden" name="form-name" value="early-access" />
              <p className="hidden">
                <label>
                  Don't fill this out if you're human: <input name="bot-field" />
                </label>
              </p>
              <div>
                <input
                  type="text"
                  name="name"
                  placeholder="Name (optional)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4b39ef] focus:border-transparent outline-none"
                />
              </div>
              <div>
                <input
                  type="email"
                  name="email"
                  placeholder="Email address"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4b39ef] focus:border-transparent outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={formStatus === 'submitting'}
                className="w-full btn-primary btn disabled:opacity-50"
              >
                {formStatus === 'submitting' ? 'Sending...' : 'Notify me'}
              </button>
              {formStatus === 'error' && (
                <p className="text-red-600 text-sm">Something went wrong. Please try again.</p>
              )}
            </form>
          )}
          <p className="mt-4 text-sm text-gray-500">
            No spam. Early access invites only.
          </p>
          <p className="mt-2 text-xs text-gray-400">
            We only use your email to contact you about early access.
          </p>
        </div>
      </section>
    </Layout>
  );
}
