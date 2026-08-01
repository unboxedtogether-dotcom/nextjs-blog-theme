import { useState } from 'react';
import Layout from '../components/Layout';
import SEO from '../components/SEO';
import { siteConfig } from '../utils/site-config';
import Link from 'next/link';
import { useAuth } from '../components/auth/AuthProvider';

const exampleSearches = ['E102', 'Tartrazine', 'E211'];

const splitList = (value) => {
  if (!value) return [];
  const items = value.split(/\s*•\s*/).map((item) => item.trim()).filter(Boolean);
  return items.length ? items : [value];
};

const riskTone = (riskIndicator) => {
  const value = riskIndicator.toLowerCase();
  if (value.includes('highest')) return 'red';
  if (value.includes('higher')) return 'orange';
  if (value.includes('moderate')) return 'amber';
  return 'green';
};

const cleanRiskLabel = (riskIndicator) => riskIndicator.replace(/^[^A-Za-z]+/, '').trim();

function SearchIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <circle cx="11" cy="11" r="7" strokeWidth="2" />
      <path d="m20 20-4-4" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SectionIcon({ type }) {
  const paths = {
    evidence: <><path d="M9 18h6" /><path d="M10 22h4" /><path d="M8.5 14.5A6 6 0 1 1 15.5 14.5c-1 .75-1.5 1.5-1.5 2.5h-4c0-1-.5-1.75-1.5-2.5Z" /></>,
    stacking: <><path d="M9 3h6" /><path d="M10 3v5l-5 9a2 2 0 0 0 1.75 3h10.5A2 2 0 0 0 19 17l-5-9V3" /><path d="M8 15h8" /></>,
    people: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2" /><path d="M3 20c0-4 2.5-7 6-7s6 3 6 7" /><path d="M15 14c3 0 5 2 5 5" /></>,
    leaf: <><path d="M20 4C12 4 5 8 5 15c0 2 1 4 3 5" /><path d="M5 19c3-5 7-8 12-10" /></>,
    shield: <><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></>,
  };

  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[type]}
    </svg>
  );
}

function TimelineIcon({ type }) {
  const paths = {
    exposure: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 1.5" /></>,
    processing: <><circle cx="8" cy="12" r="3" /><circle cx="16.5" cy="8" r="2.5" /><circle cx="16" cy="16" r="2" /><path d="M10.5 10.5 14 9M10.5 13.5l3.7 1.7" /></>,
    clearance: <><rect x="4" y="6" width="16" height="14" rx="2" /><path d="M8 3v6M16 3v6M4 11h16M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" /></>,
  };

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[type]}
    </svg>
  );
}

function DetailSection({ icon, title, value, tone = 'blue' }) {
  const items = splitList(value);

  return (
    <section className={`additive-detail additive-detail-${tone}`}>
      <div className="additive-detail-heading">
        <span className="additive-detail-icon"><SectionIcon type={icon} /></span>
        <h3>{title}</h3>
      </div>
      {items.length > 1 ? (
        <ul>
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : (
        <p>{items[0]}</p>
      )}
    </section>
  );
}

function AdditiveCard({ additive }) {
  const tone = riskTone(additive.riskIndicator);
  const foundIn = splitList(additive.foundIn);
  const sourceNames = additive.sources.split(';').map((source) => source.trim()).filter(Boolean);

  return (
    <article className="additive-card">
      <header className="additive-card-header">
        <div>
          <p className="additive-eyebrow">Additive profile</p>
          <h2>{additive.eNumber}</h2>
          <p className="additive-name">{additive.additiveName}</p>
          <p className="additive-category"><span>Category</span>{additive.category}</p>
        </div>
        <div className={`risk-badge risk-badge-${tone}`}>
          <span className="risk-mark" aria-hidden="true">!</span>
          <div>
            <strong>{cleanRiskLabel(additive.riskIndicator)}</strong>
            <small>Awareness level — not a danger rating</small>
          </div>
        </div>
      </header>

      <section className="additive-found-in">
        <h3>Found in</h3>
        <div>
          {foundIn.map((item) => <span key={item}>{item}</span>)}
        </div>
      </section>

      <section className="additive-timeline" aria-label="Practical timeline">
        <div>
          <span className="timeline-symbol"><TimelineIcon type="exposure" /></span>
          <p>Peak exposure</p>
          <strong>{additive.peakExposure}</strong>
        </div>
        <div>
          <span className="timeline-symbol"><TimelineIcon type="processing" /></span>
          <p>Processing</p>
          <strong>{additive.processing}</strong>
        </div>
        <div>
          <span className="timeline-symbol"><TimelineIcon type="clearance" /></span>
          <p>Typical clearance</p>
          <strong>{additive.typicalClearance}</strong>
        </div>
      </section>

      <section className="additive-facts">
        <div><span>Food function</span><strong>{additive.foodFunction}</strong></div>
        <div><span>ADI</span><strong>{additive.adi}</strong></div>
        <div>
          <span>Sources</span>
          <strong>{sourceNames.join(' · ')}</strong>
        </div>
      </section>

      <div className="additive-sections">
        <DetailSection icon="evidence" title="Evidence suggests" value={additive.evidenceSuggests} tone="red" />
        <DetailSection icon="stacking" title="Stacking factors" value={additive.stackingFactors} />
        <DetailSection icon="people" title="Who should be aware" value={additive.whoShouldBeAware} />
        <DetailSection icon="leaf" title="Natural alternatives" value={additive.naturalAlternatives} tone="green" />
        <DetailSection icon="shield" title="UK regulatory status" value={additive.ukRegulatoryStatus} />
      </div>

      <section className="unboxed-view">
        <span className="unboxed-eye" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
            <circle cx="12" cy="12" r="2.5" />
          </svg>
        </span>
        <div>
          <h3>The Unboxed View</h3>
          <p>{additive.unboxedView}</p>
        </div>
      </section>

      <p className="additive-footnote">
        * Timelines are practical guidance, not exact biological clocks; clearance can vary by person and dose.
      </p>
    </article>
  );
}

function AdditivePreview({ additive }) {
  return (
    <article className="additive-card additive-preview-card">
      <header className="additive-card-header">
        <div><p className="additive-eyebrow">Preview result</p><h2>{additive.eNumber}</h2><p className="additive-name">{additive.additiveName}</p><p className="additive-category"><span>Category</span>{additive.category}</p></div>
      </header>
      <section className="additive-access-panel">
        <p className="additive-eyebrow">Member breakdown</p>
        <h3>See the full Unboxed breakdown</h3>
        <p>Create a free account to view the complete additive record and begin building your own clearer picture of food, focus, mood, sleep and digestion.</p>
        <div><Link className="member-button" href="/signup">Join free</Link><Link className="member-button secondary" href="/login?next=/additives">Log in</Link></div>
      </section>
    </article>
  );
}

function LoadingCard() {
  return (
    <div className="additive-loading" role="status" aria-label="Searching additive library">
      <div className="loading-line loading-line-short" />
      <div className="loading-line loading-line-title" />
      <div className="loading-grid">
        <div /><div /><div />
      </div>
      <div className="loading-line" />
      <div className="loading-line" />
      <span className="sr-only">Searching...</span>
    </div>
  );
}

export default function Additives() {
  const { user, loading: authLoading } = useAuth();
  const [query, setQuery] = useState('');
  const [searchedQuery, setSearchedQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [authenticated, setAuthenticated] = useState(false);

  const search = async (searchTerm) => {
    const value = searchTerm.trim();
    if (!value) return;

    const normalizedValue = value.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!normalizedValue) {
      setSearchedQuery(value);
      setResults([]);
      setStatus('empty');
      return;
    }

    setQuery(value);
    setSearchedQuery(value);
    setStatus('loading');
    setError('');

    try {
      const endpoint = user ? '/api/member-additives' : '/api/additives';
      const response = await fetch(`${endpoint}?q=${encodeURIComponent(value)}`, { cache: 'no-store' });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Search failed');

      setResults(data.results);
      setAuthenticated(Boolean(data.authenticated));
      setSelectedIndex(0);
      setStatus(data.results.length ? 'success' : 'empty');
    } catch (searchError) {
      setResults([]);
      setError(searchError.message || 'The additive library is temporarily unavailable.');
      setStatus('error');
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    search(query);
  };

  return (
    <Layout>
      <SEO
        title={siteConfig.seo.additives.title}
        description={siteConfig.seo.additives.description}
        path="/additives"
      />

      <div className="additive-page">
        <section className="additive-search-hero">
          <div className="additive-orbit additive-orbit-one" />
          <div className="additive-orbit additive-orbit-two" />
          <div className="additive-search-copy">
            <p className="additive-kicker">Unboxed Additive Library</p>
            <h1>Know what’s behind the number.</h1>
            <p>Search an E number or additive here.</p>
          </div>

          <form className="additive-search-form" onSubmit={handleSubmit}>
            <label htmlFor="additive-search">Additive name or E number</label>
            <div className="additive-search-control">
              <SearchIcon className="w-6 h-6" />
              <input
                id="additive-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Try E102, 102 or Tartrazine"
                autoComplete="off"
              />
              <button type="submit" disabled={status === 'loading' || authLoading}>
                {status === 'loading' || authLoading ? 'Searching' : 'Search'}
              </button>
            </div>
            <div className="additive-examples">
              <span>Popular searches</span>
              {exampleSearches.map((example) => (
                <button type="button" key={example} onClick={() => search(example)}>{example}</button>
              ))}
            </div>
          </form>
        </section>

        <main className="additive-results" aria-live="polite">
          {status === 'idle' && (
            <section className="additive-empty-state">
              <div className="empty-search-icon"><SearchIcon className="w-8 h-8" /></div>
              <h2>Search the additive library</h2>
              <p>Enter an E number with or without the “E”, or search using the additive’s name.</p>
            </section>
          )}

          {status === 'loading' && <LoadingCard />}

          {status === 'empty' && (
            <section className="additive-empty-state additive-no-result">
              <div className="empty-search-icon"><SearchIcon className="w-8 h-8" /></div>
              <h2>No published result for “{searchedQuery}”</h2>
              <p>Check the spelling or try the E number. Some library entries remain hidden while their research review is completed.</p>
            </section>
          )}

          {status === 'error' && (
            <section className="additive-error" role="alert">
              <strong>We couldn’t search the library.</strong>
              <p>{error}</p>
              <button type="button" onClick={() => search(searchedQuery)}>Try again</button>
            </section>
          )}

          {status === 'success' && results.length > 0 && (
            <>
              {results.length > 1 && (
                <div className="additive-matches">
                  <p>{results.length} matches found</p>
                  <div>
                    {results.map((result, index) => (
                      <button
                        type="button"
                        key={`${result.eNumber}-${result.additiveName}`}
                        className={selectedIndex === index ? 'active' : ''}
                        onClick={() => setSelectedIndex(index)}
                      >
                        <strong>{result.eNumber}</strong>
                        <span>{result.additiveName}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {authenticated ? <AdditiveCard additive={results[selectedIndex]} /> : <AdditivePreview additive={results[selectedIndex]} />}
            </>
          )}
        </main>
      </div>
    </Layout>
  );
}
