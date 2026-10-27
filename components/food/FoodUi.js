import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

// Shared pieces for the Food Database search page and both detail layouts.

export const typeLabels = { additive: 'Additive', ingredient: 'Ingredient' };
export const recordHref = (record) => `/${record.type === 'additive' ? 'additives' : 'ingredients'}/${record.slug}`;
export const filters = [['all', 'All'], ['additives', 'Additives'], ['ingredients', 'Ingredients']];

// Library text uses "•", ";" or "|" between items.
export const splitList = (value, pattern = /\s*•\s*/) => {
  if (!value) return [];
  const items = String(value).split(pattern).map((item) => item.trim()).filter(Boolean);
  return items.length ? items : [value];
};
export const splitTerms = (value) => splitList(value, /\s*[;|]\s*/);
export const urlsIn = (value) => [...new Set(String(value || '').match(/https?:\/\/[^\s|;,]+/g) || [])].map((url) => url.replace(/[.)]+$/, ''));
export const sourceHost = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
};
export const formatReviewed = (value) => {
  if (!value) return '';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
};

// The awareness wording comes from the additive record; the colour only mirrors it.
export const riskTone = (riskIndicator = '') => {
  const value = riskIndicator.toLowerCase();
  if (value.includes('highest')) return 'red';
  if (value.includes('higher')) return 'orange';
  if (value.includes('low/moderate')) return 'lime';
  if (value.includes('moderate')) return 'amber';
  return 'green';
};
export const cleanRiskLabel = (riskIndicator = '') => riskIndicator.replace(/^[^A-Za-z]+/, '').trim();

const iconPaths = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  back: <><path d="M15 18 9 12l6-6" /></>,
  arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  flask: <><path d="M9 3h6" /><path d="M10 3v5l-5 9a2 2 0 0 0 1.75 3h10.5A2 2 0 0 0 19 17l-5-9V3" /><path d="M8 15h8" /></>,
  leaf: <><path d="M20 4C12 4 5 8 5 15c0 2 1 4 3 5" /><path d="M5 19c3-5 7-8 12-10" /></>,
  evidence: <><path d="M9 18h6" /><path d="M10 22h4" /><path d="M8.5 14.5A6 6 0 1 1 15.5 14.5c-1 .75-1.5 1.5-1.5 2.5h-4c0-1-.5-1.75-1.5-2.5Z" /></>,
  people: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2" /><path d="M3 20c0-4 2.5-7 6-7s6 3 6 7" /><path d="M15 14c3 0 5 2 5 5" /></>,
  shield: <><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></>,
  book: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z" /><path d="M4 19a2 2 0 0 1 2-2h13" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" /><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" /></>,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 1.5" /></>,
  process: <><circle cx="8" cy="12" r="3" /><circle cx="16.5" cy="8" r="2.5" /><circle cx="16" cy="16" r="2" /><path d="M10.5 10.5 14 9M10.5 13.5l3.7 1.7" /></>,
  calendar: <><rect x="4" y="6" width="16" height="14" rx="2" /><path d="M8 3v6M16 3v6M4 11h16" /></>,
  basket: <><path d="M5 10h14l-1.5 9h-11L5 10Z" /><path d="m9 10 3-6 3 6" /></>,
  tag: <><path d="M3 12V4h8l9 9-8 8-9-9Z" /><circle cx="7.5" cy="8.5" r="1.5" /></>,
  swap: <><path d="M7 7h12l-3-3" /><path d="M17 17H5l3 3" /></>,
  eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
  wheat: <><path d="M12 21V9" /><path d="M12 9c-3 0-4-2-4-5 3 0 4 2 4 5Zm0 0c3 0 4-2 4-5-3 0-4 2-4 5Z" /><path d="M12 15c-3 0-4-2-4-4 3 0 4 1 4 4Zm0 0c3 0 4-2 4-4-3 0-4 1-4 4Z" /></>,
  drop: <><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" /></>,
  bolt: <><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></>,
  fibre: <><path d="M4 18c4-1 6-5 8-12" /><path d="M10 20c3-2 5-6 6-14" /><path d="M16 20c2-3 3-7 4-12" /></>,
  egg: <><path d="M12 3c3.5 0 6 5 6 9a6 6 0 0 1-12 0c0-4 2.5-9 6-9Z" /></>,
  gut: <><path d="M8 4v4a4 4 0 0 0 4 4h0a4 4 0 0 1 4 4v0a4 4 0 0 1-4 4H9" /></>,
  pulse: <><path d="M3 12h4l2-5 4 10 2-5h6" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  alert: <><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17h.01" /></>,
  scale: <><path d="M12 4v16M5 20h14" /><path d="m5 8 7-3 7 3" /><path d="M2 14l3-6 3 6a3 3 0 0 1-6 0ZM16 14l3-6 3 6a3 3 0 0 1-6 0Z" /></>,
};

export function Icon({ name, className = 'food-icon' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {iconPaths[name]}
    </svg>
  );
}

export function TypeBadge({ type }) {
  return <span className={`food-type food-type-${type}`}><Icon name={type === 'additive' ? 'flask' : 'leaf'} />{typeLabels[type]}</span>;
}

// The single Food Database search box, used on the search page and on both detail pages.
export function FoodSearchBox({ initialQuery = '', initialType = 'all', compact = false, onSearch }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState(initialType);
  const submit = (event) => {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    if (onSearch) onSearch(value, type);
    else router.push({ pathname: '/additives', query: { q: value, ...(type !== 'all' ? { type } : {}) } });
  };
  return (
    <form className={`additive-search-form food-search-form${compact ? ' is-compact' : ''}`} onSubmit={submit} role="search">
      <label htmlFor={compact ? 'food-search-compact' : 'food-search'}>Search ingredients, additives or E numbers</label>
      <div className="additive-search-control">
        <Icon name="search" className="w-6 h-6" />
        <input
          id={compact ? 'food-search-compact' : 'food-search'}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try E102, maltodextrin or oat fibre"
          autoComplete="off"
        />
        <button type="submit">Search</button>
      </div>
      {!compact && (
        <div className="food-filter" role="radiogroup" aria-label="Show results from">
          {filters.map(([key, label]) => (
            <button key={key} type="button" role="radio" aria-checked={type === key} className={type === key ? 'is-active' : ''}
              onClick={() => { setType(key); if (onSearch && query.trim()) onSearch(query.trim(), key); }}>
              {label}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}

export function ResultCard({ result }) {
  return (
    <article className={`food-result food-result-${result.type}`}>
      <div className="food-result-top">
        <TypeBadge type={result.type} />
        {result.eNumber && <span className="food-enumber">{result.eNumber}</span>}
      </div>
      <h3>{result.name}</h3>
      {result.category && <p className="food-result-category">{result.category}</p>}
      {result.summary && <p className="food-result-summary">{result.summary}</p>}
      {result.keyInfo?.length > 0 && (
        <dl className="food-result-facts">
          {result.keyInfo.map((item) => (
            <div key={item.label} className={item.tone ? `risk-text-${riskTone(item.tone)}` : ''}>
              <dt>{item.label}</dt><dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <Link className="food-result-link" href={recordHref(result)}>
        View full {typeLabels[result.type].toLowerCase()} profile <Icon name="arrow" />
      </Link>
    </article>
  );
}

// Header bar on both detail pages: back to the visitor's search, plus the search box.
export function DetailTopBar() {
  const router = useRouter();
  const back = (event) => {
    event.preventDefault();
    if (typeof window !== 'undefined' && window.history.length > 1 && document.referrer.startsWith(window.location.origin)) router.back();
    else router.push('/additives');
  };
  return (
    <div className="food-topbar">
      <Link href="/additives" className="food-back" onClick={back}><Icon name="back" /> Back to search</Link>
      <FoodSearchBox compact />
    </div>
  );
}

export function MembersOnly({ preview, path }) {
  return (
    <article className="food-detail-card">
      <header className="food-hero">
        <div className="food-hero-badges"><TypeBadge type={preview.type} />{preview.eNumber && <span className="food-enumber">{preview.eNumber}</span>}</div>
        <h1>{preview.name}</h1>
        {preview.category && <p className="food-hero-category">{preview.category}</p>}
        {preview.summary && <p className="food-hero-lead">{preview.summary}</p>}
      </header>
      <section className="additive-access-panel">
        <p className="additive-eyebrow">Member breakdown</p>
        <h3>See the full Unboxed breakdown</h3>
        <p>Create a free account to view the complete {typeLabels[preview.type].toLowerCase()} record and begin building your own clearer picture of food, focus, mood, sleep and digestion.</p>
        <div><Link className="member-button" href="/signup">Join free</Link><Link className="member-button secondary" href={`/login?next=${encodeURIComponent(path)}`}>Log in</Link></div>
      </section>
    </article>
  );
}

// A titled section that hides itself when the library has nothing recorded.
export function InfoSection({ icon, title, intro, children, tone = 'blue', id }) {
  return (
    <section className={`food-section food-section-${tone}`} id={id} aria-labelledby={id ? `${id}-title` : undefined}>
      <div className="food-section-heading">
        <span className="food-section-icon"><Icon name={icon} /></span>
        <div><h2 id={id ? `${id}-title` : undefined}>{title}</h2>{intro && <p>{intro}</p>}</div>
      </div>
      <div className="food-section-body">{children}</div>
    </section>
  );
}

export function Field({ label, value, icon, list = false }) {
  if (!value) return null;
  const items = list ? splitTerms(value) : null;
  return (
    <div className="food-field">
      <h3>{icon && <Icon name={icon} />}{label}</h3>
      {items && items.length > 1 ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p>{value}</p>}
    </div>
  );
}

export function Chips({ items, tone = '' }) {
  if (!items.length) return null;
  return <div className={`food-chips ${tone}`}>{items.map((item) => <span key={item}>{item}</span>)}</div>;
}

export function References({ urls }) {
  if (!urls.length) return null;
  return (
    <ol className="food-references">
      {urls.map((url) => (
        <li key={url}>
          <a href={url} target="_blank" rel="noopener noreferrer"><Icon name="link" /><span><strong>{sourceHost(url)}</strong><small>{url}</small></span></a>
        </li>
      ))}
    </ol>
  );
}
