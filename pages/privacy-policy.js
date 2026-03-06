import Layout from '../components/Layout';
import SEO from '../components/SEO';
import { siteConfig } from '../utils/site-config';

export default function PrivacyPolicy() {
  return (
    <Layout>
      <SEO
        title={siteConfig.seo.privacyPolicy.title}
        description={siteConfig.seo.privacyPolicy.description}
      />

      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold text-[#4b39ef] mb-8">
            Privacy Policy
          </h1>

          <p className="text-gray-600 mb-8">
            {siteConfig.siteName} respects your privacy and is committed to protecting your personal data.
          </p>

          {/* Information We Collect */}
          <h2 className="text-2xl font-bold text-[#4b39ef] mb-4">
            Information We Collect
          </h2>
          <p className="text-gray-600 mb-4">
            When using the app we may collect:
          </p>
          <ul className="list-disc list-inside text-gray-600 mb-4 space-y-2">
            <li>Email address (for account login)</li>
            <li>User account information</li>
            <li>Product scan history</li>
            <li>Basic app usage data</li>
          </ul>
          <p className="text-gray-600 mb-8">
            This information is used only to provide the functionality of the app and improve the service.
          </p>

          {/* Camera Permission */}
          <h2 className="text-2xl font-bold text-[#4b39ef] mb-4">
            Camera Permission
          </h2>
          <p className="text-gray-600 mb-4">
            The {siteConfig.siteName} app requires access to your device camera.
          </p>
          <ul className="list-disc list-inside text-gray-600 mb-8 space-y-2">
            <li>The camera is used only to scan product barcodes so the app can identify food products and analyze ingredients.</li>
            <li>The app does not record, store, or transmit photos or video from your camera.</li>
            <li>Camera access is only active while the user is scanning a barcode.</li>
          </ul>

          {/* Third-Party Services */}
          <h2 className="text-2xl font-bold text-[#4b39ef] mb-4">
            Third-Party Services
          </h2>
          <p className="text-gray-600 mb-4">
            The app may use third-party services including:
          </p>
          <ul className="list-disc list-inside text-gray-600 mb-4 space-y-2">
            <li>Firebase Authentication (for account login)</li>
            <li>Google Play Services</li>
            <li>Open Food Facts product database (to retrieve product information)</li>
          </ul>
          <p className="text-gray-600 mb-8">
            These services may process limited technical information required for app functionality.
          </p>

          {/* How We Use Your Data */}
          <h2 className="text-2xl font-bold text-[#4b39ef] mb-4">
            How We Use Your Data
          </h2>
          <p className="text-gray-600 mb-4">
            Your information is used to:
          </p>
          <ul className="list-disc list-inside text-gray-600 mb-4 space-y-2">
            <li>Provide barcode scanning and product analysis</li>
            <li>Maintain your user account</li>
            <li>Improve the app experience</li>
            <li>Provide product insights and additive analysis</li>
          </ul>
          <p className="text-gray-600 mb-8">
            We do not sell personal data to third parties.
          </p>

          {/* Data Storage */}
          <h2 className="text-2xl font-bold text-[#4b39ef] mb-4">
            Data Storage
          </h2>
          <p className="text-gray-600 mb-4">
            User data may be securely stored using cloud infrastructure.
          </p>
          <p className="text-gray-600 mb-8">
            Users may request deletion of their account data at any time.
          </p>

          {/* Contact */}
          <h2 className="text-2xl font-bold text-[#4b39ef] mb-4">
            Contact
          </h2>
          <p className="text-gray-600 mb-2">
            If you have any questions about this Privacy Policy, contact:
          </p>
          <a
            href={`mailto:${siteConfig.email}`}
            className="text-[#4b39ef] hover:underline font-semibold"
          >
            {siteConfig.email}
          </a>

          {/* Company Info */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            <p className="text-gray-500 text-sm">
              {siteConfig.companyName} (United Kingdom)
            </p>
          </div>
        </div>
      </section>
    </Layout>
  );
}
