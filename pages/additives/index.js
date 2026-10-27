import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import SEO from '../../components/SEO';
import { siteConfig } from '../../utils/site-config';
import { FoodSearchBox, Icon, ResultCard, filters } from '../../components/food/FoodUi';

const exampleSearches = ['E102', 'Maltodextrin', 'Tartrazine', 'Oat fibre', 'Gum'];
const filterKeys = filters.map(([key]) => key);

function LoadingCards() {
  return (
    <div className="food-results-grid" role="status" aria-label="Searching the food database">
      {[0, 1, 2].map((item) => (
        <div className="food-result food-result-loading" key={item}>
          <div className="loading-line loading-line-short" />
          <div className="loading-line" style={{ width: '70%', height: '1.6rem' }} />
          <div className="loading-line" />
          <div className="loading-line" />
        </div>
      ))}
      <span className="sr-only">Searching…</span>
    </div>
  );
}

// The Food Database: one search box across the additive and ingredient
// libraries. The search and filter live in the address so "Back to search"
// on a detail page returns to the same results.
export default function FoodDatabase() {
  const router = useRouter();
  const query = router.isReady && typeof router.query.q === 'string' ? router.query.q.slice(0, 80) : '';
  const type = router.isReady && filterKeys.includes(router.query.type) ? router.query.type : 'all';
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${query}|${type}|${attempt}`;
  const [response, setResponse] = useState({ key: '', status: 'idle', results: [], counts: { additive: 0, ingredient: 0 }, error: '' });

  useEffect(() => {
    if (!router.isReady || !query.trim()) return undefined;
    let cancelled = false;
    fetch(`/api/food/search?q=${encodeURIComponent(query)}&type=${type}`)
      .then(async (result) => {
        const data = await result.json();
        if (!result.ok) throw new Error(data.error || 'Search failed');
        if (!cancelled) setResponse({ key: requestKey, status: data.results.length ? 'success' : 'empty', results: data.results, counts: data.counts, error: '' });
      })
      .catch((error) => { if (!cancelled) setResponse({ key: requestKey, status: 'error', results: [], counts: { additive: 0, ingredient: 0 }, error: error.message || 'The food database is temporarily unavailable.' }); });
    return () => { cancelled = true; };
  }, [router.isReady, query, type, requestKey]);

  const idle = { status: 'idle', results: [], counts: { additive: 0, ingredient: 0 }, error: '' };
  const state = !router.isReady || !query.trim() ? idle : response.key === requestKey ? response : { ...idle, status: 'loading' };

  const search = (value, nextType = type) => {
    router.push({ pathname: '/additives', query: { q: value, ...(nextType !== 'all' ? { type: nextType } : {}) } }, undefined, { shallow: true, scroll: false });
  };
  const total = state.counts.additive + state.counts.ingredient;
  const shownLabel = type === 'additives' ? 'additives' : type === 'ingredients' ? 'ingredients' : 'results';

  return (
    <Layout>
      <SEO title={siteConfig.seo.additives.title} description={siteConfig.seo.additives.description} path="/additives" />

      <div className="additive-page food-page">
        <section className="additive-search-hero">
          <div className="additive-orbit additive-orbit-one" />
          <div className="additive-orbit additive-orbit-two" />
          <div className="additive-search-copy">
            <p className="additive-kicker">Unboxed Food Database</p>
            <h1>Know what’s in your food.</h1>
            <p>Search ingredients, additives and E numbers in one place.</p>
          </div>
          <div>
            <FoodSearchBox key={`${query}-${type}`} initialQuery={query} initialType={type} onSearch={search} />
            <div className="additive-examples">
              <span>Popular searches</span>
              {exampleSearches.map((example) => (
                <button type="button" key={example} onClick={() => search(example)}>{example}</button>
              ))}
            </div>
          </div>
        </section>

        <div className="additive-results food-results" aria-live="polite">
          {state.status === 'idle' && (
            <section className="additive-empty-state">
              <div className="empty-search-icon"><Icon name="search" className="w-8 h-8" /></div>
              <h2>Search the food database</h2>
              <p>Type an ingredient, an additive name or an E number (with or without the “E”). You don’t need to know which library it belongs to — we search both.</p>
              <div className="food-library-key">
                <span className="food-type food-type-additive"><Icon name="flask" />Additives</span>
                <span>E numbers and approved food additives</span>
                <span className="food-type food-type-ingredient"><Icon name="leaf" />Ingredients</span>
                <span>Everyday and processed food ingredients</span>
              </div>
            </section>
          )}

          {state.status === 'loading' && <LoadingCards />}

          {state.status === 'empty' && (
            <section className="additive-empty-state additive-no-result">
              <div className="empty-search-icon"><Icon name="search" className="w-8 h-8" /></div>
              <h2>No published {shownLabel} for “{query}”</h2>
              {type !== 'all' && total > 0
                ? <p>There {total === 1 ? 'is' : 'are'} {total} {total === 1 ? 'match' : 'matches'} in the other library. <button type="button" className="text-button" onClick={() => search(query, 'all')}>Show all results</button></p>
                : <p>Check the spelling, try a shorter word or search by E number. Some entries stay hidden while their research review is completed.</p>}
            </section>
          )}

          {state.status === 'error' && (
            <section className="additive-error" role="alert">
              <strong>We couldn’t search the database.</strong>
              <p>{state.error}</p>
              <button type="button" onClick={() => setAttempt((count) => count + 1)}>Try again</button>
            </section>
          )}

          {state.status === 'success' && (
            <>
              <div className="food-results-summary">
                <p><strong>{state.results.length}{state.results.length < (type === 'additives' ? state.counts.additive : type === 'ingredients' ? state.counts.ingredient : total) ? '+' : ''}</strong> {shownLabel} for “{query}”</p>
                <p className="food-results-split">{state.counts.ingredient} {state.counts.ingredient === 1 ? 'ingredient' : 'ingredients'} · {state.counts.additive} {state.counts.additive === 1 ? 'additive' : 'additives'}</p>
              </div>
              <div className="food-results-grid">
                {state.results.map((result) => <ResultCard key={`${result.type}-${result.slug}`} result={result} />)}
              </div>
              {state.results.length >= 40 && <p className="food-results-more">Showing the 40 closest matches. Add another word to narrow your search.</p>}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
