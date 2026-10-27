import Layout from '../../components/Layout';
import SEO from '../../components/SEO';
import BrandLoader from '../../components/BrandLoader';
import { DetailTopBar, Field, Icon, InfoSection, MembersOnly, TypeBadge, cleanRiskLabel, formatReviewed, riskTone, splitList } from '../../components/food/FoodUi';
import { useFoodRecord } from '../../components/food/useFoodRecord';

const referenceLinks = (record) => [
  [record.source_url_uk_list, 'UK approved additives and E numbers list'],
  [record.source_url_fsa, 'Food Standards Agency'],
  [record.source_url_efsa, 'European Food Safety Authority'],
].filter(([url]) => url);

function ListOrText({ value }) {
  const items = splitList(value);
  return items.length > 1 ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p>{value}</p>;
}

function AttentionScale({ value }) {
  const match = String(value || '').match(/^(\d)\s*\/\s*(\d)$/);
  if (!match) return value ? <span>{value}</span> : null;
  const [, level, max] = match.map(Number);
  return (
    <span className="food-attention" aria-label={`Attention level ${level} out of ${max}`}>
      {Array.from({ length: max }, (_, index) => <i key={index} className={index < level ? 'is-on' : ''} />)}
      <b>{level}/{max}</b>
    </span>
  );
}

function AdditiveProfile({ record }) {
  const tone = riskTone(record.risk_indicator);
  const sourceNames = splitList(record.sources, /\s*;\s*/);

  return (
    <article className="food-detail-card food-detail-additive">
      <header className="food-hero">
        <div className="food-hero-main">
          <div className="food-hero-badges"><TypeBadge type="additive" /><span className="food-enumber">{record.e_number}</span></div>
          <h1>{record.additive_name}</h1>
          <p className="food-hero-category">{record.category}</p>
          <p className="food-hero-lead">{record.food_function}</p>
        </div>
        <aside className={`risk-badge risk-badge-${tone} food-awareness`}>
          <span className="risk-mark" aria-hidden="true">!</span>
          <div>
            <strong>{cleanRiskLabel(record.risk_indicator)}</strong>
            <AttentionScale value={record.attention_level} />
            <small>Awareness level — not a danger rating</small>
          </div>
        </aside>
      </header>

      <nav className="food-jump" aria-label="On this page">
        <a href="#timeline">Exposure timeline</a><a href="#findings">What the evidence says</a><a href="#alternatives">Alternatives</a><a href="#unboxed-view">Unboxed View</a><a href="#evidence">References</a>
      </nav>

      <dl className="food-facts">
        <div><dt><Icon name="process" />Function</dt><dd>{record.food_function}</dd></div>
        <div><dt><Icon name="scale" />Acceptable daily intake</dt><dd>{record.adi}</dd></div>
        <div><dt><Icon name="evidence" />Evidence strength</dt><dd>{record.evidence_strength}</dd></div>
        <div><dt><Icon name="book" />Research status</dt><dd>{record.research_status}</dd></div>
      </dl>

      {record.found_in && (
        <section className="additive-found-in food-found-in">
          <h3><Icon name="basket" />Typical foods</h3>
          <div>{splitList(record.found_in).map((item) => <span key={item}>{item}</span>)}</div>
        </section>
      )}

      <section className="food-timeline" id="timeline" aria-labelledby="timeline-title">
        <div className="food-timeline-heading">
          <h2 id="timeline-title">Unboxed Exposure Timeline</h2>
          <span className="food-estimate-tag">General estimate</span>
        </div>
        <ol className="additive-timeline">
          <li><span className="timeline-symbol"><Icon name="clock" /></span><p>Peak exposure</p><strong>{record.peak_exposure}</strong></li>
          <li><span className="timeline-symbol"><Icon name="process" /></span><p>Processing</p><strong>{record.processing}</strong></li>
          <li><span className="timeline-symbol"><Icon name="calendar" /></span><p>Typical clearance</p><strong>{record.typical_clearance}</strong></li>
        </ol>
        <p className="food-timeline-note">
          <Icon name="info" />
          These timings are practical Unboxed guidance, not measured values for this additive or for you. Timing varies by person, dose, diet and health. It is not a medical or “detox” clearance time.
        </p>
      </section>

      <div className="food-sections">
        <InfoSection icon="evidence" title="Evidence suggests" id="findings">
          <ListOrText value={record.evidence_suggests} />
        </InfoSection>
        <InfoSection icon="layers" title="Stacking factors" intro="Things that can add up across a day of eating.">
          <ListOrText value={record.stacking_factors} />
        </InfoSection>
        <InfoSection icon="people" title="Who should be aware">
          <ListOrText value={record.who_should_be_aware} />
        </InfoSection>
        <InfoSection icon="leaf" title="Natural alternatives" tone="green" id="alternatives">
          <ListOrText value={record.natural_alternatives} />
        </InfoSection>
        <InfoSection icon="shield" title="UK regulatory status">
          <ListOrText value={record.uk_regulatory_status} />
        </InfoSection>
      </div>

      <section className="unboxed-view food-unboxed-view" id="unboxed-view">
        <span className="unboxed-eye" aria-hidden="true"><Icon name="eye" /></span>
        <div>
          <p className="food-view-label">Our interpretation</p>
          <h3>The Unboxed View</h3>
          <p>{record.unboxed_view}</p>
          <small>This is Unboxed Together’s plain-English view. It sits alongside, and does not replace, the scientific and regulatory sources below.</small>
        </div>
      </section>

      <InfoSection icon="book" title="Evidence and references" id="evidence">
        <div className="food-evidence-grid">
          <Field label="Evidence strength" value={record.evidence_strength} />
          <Field label="Research status" value={record.research_status} />
          <Field label="Sources" value={sourceNames.join(' · ')} />
          <Field label="Last reviewed" value={formatReviewed(record.last_reviewed)} />
        </div>
        {record.evidence_notes && <div className="food-note"><Icon name="info" /><div><h3>Research notes</h3><p>{record.evidence_notes}</p></div></div>}
        <ol className="food-references">
          {referenceLinks(record).map(([url, label]) => (
            <li key={url}><a href={url} target="_blank" rel="noopener noreferrer"><Icon name="link" /><span><strong>{label}</strong><small>{url}</small></span></a></li>
          ))}
        </ol>
        <details className="food-details">
          <summary>Technical record details</summary>
          <dl><div><dt>Library ID</dt><dd>{record.ual_id}</dd></div><div><dt>E number</dt><dd>{record.e_number}</dd></div><div><dt>Category</dt><dd>{record.category}</dd></div></dl>
        </details>
      </InfoSection>
    </article>
  );
}

export default function AdditivePage() {
  const { status, data, error, path, slug } = useFoodRecord('additive');
  const name = data?.record?.additive_name || data?.preview?.name;
  const eNumber = data?.record?.e_number || data?.preview?.eNumber;

  return (
    <Layout>
      <SEO
        title={name ? `${eNumber} ${name} | Unboxed Food Database` : 'Additive | Unboxed Food Database'}
        description={name ? `What ${name} (${eNumber}) is, where it is found and what the evidence says, from the Unboxed Food Database.` : 'An additive profile from the Unboxed Food Database.'}
        path={`/additives/${slug}`}
      />
      <div className="additive-page food-page food-detail-page">
        <DetailTopBar />
        <div className="food-detail-wrap">
          {status === 'loading' && <BrandLoader label="Loading additive…" />}
          {status === 'missing' && <section className="additive-empty-state"><h2>We couldn’t find that additive</h2><p>It may have been renamed or is still being reviewed. Try searching for its name or E number above.</p></section>}
          {status === 'error' && <section className="additive-error" role="alert"><strong>We couldn’t load this additive.</strong><p>{error}</p></section>}
          {status === 'ready' && (data.authenticated ? <AdditiveProfile record={data.record} /> : <MembersOnly preview={data.preview} path={path} />)}
        </div>
      </div>
    </Layout>
  );
}
