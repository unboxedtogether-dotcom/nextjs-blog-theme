import Navigation from './Navigation';
import Footer from './Footer';

export default function Layout({ children }) {
  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <Navigation />
      <main id="main-content" className="site-main">
        {children}
      </main>
      <Footer />
    </div>
  );
}
