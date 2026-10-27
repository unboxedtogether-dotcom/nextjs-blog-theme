import Link from 'next/link';
import Layout from '../../components/Layout';
import SEO from '../../components/SEO';
import BrandLoader from '../../components/BrandLoader';
import { Chips, DetailTopBar, Field, Icon, InfoSection, MembersOnly, References, TypeBadge, formatReviewed, splitTerms, urlsIn } from '../../components/food/FoodUi';
import { useFoodRecord } from '../../components/food/useFoodRecord';

// Plain status words from the library get a simple matching marker; anything
// more nuanced ("Source-dependent", "Check manufacturer") is shown as "check".
const dietTone = (value = '') => {
  const text = value.toLowerCase().trim();
  if (/^(no|not\b)/.test(text)) return 'no';
  if (/^(yes|vegan|vegetarian)\b/.test(text) && !/depend|usually|check|may/.test(text)) return 'yes';
  return 'check';
};
const dietMarker = { yes: 'shield', no: 'info', check: 'alert' };

function DietStatus({ label, value }) {
  if (!value) return null;
  const tone = dietTone(value);
  return (
    <div className={`food-diet food-diet-${tone}`}>
      <Icon name={dietMarker[tone]} />
      <div><span>{label}</span><strong>{value}</strong></div>
    </div>
  );
}

function NutrientTile({ icon, label, value }) {
  if (!value) return null;
  return (
    <div className="food-nutrient">
      <span className="food-nutrient-icon"><Icon name={icon} /></span>
      <h3>{label}</h3>
      <p>{value}</p>
    </div>
  );
}

const additionalFields = [
  ['scanner_matching_terms', 'Scanner matching terms'],
  ['common_misspellings', 'Common misspellings'],
  ['related_additives', 'Related additives'],
];

function IngredientProfile({ record }) {
  const synonyms = splitTerms(record.alternative_names);
  const labelNames = splitTerms(record.label_names);
  const references = urlsIn(record.reference_sources);
  const otherReferenceText = String(record.reference_sources || '').replace(/https?:\/\/[^\s|;,]+/g, '').replace(/[\s|;,]+/g, ' ').trim();
  const extras = Object.entries(record.extra_fields || {}).filter(([, value]) => value);
  const hasNutrition = ['main_nutritional_contribution', 'protein_relevance', 'fat_relevance', 'carbohydrate_sugar_relevance', 'fibre_relevance'].some((key) => record[key]);
  const hasUnderstanding = ['commonly_found_in', 'blood_sugar_relevance', 'gut_relevance', 'inflammation_relevance'].some((key) => record[key]) || labelNames.length;
  const hasDiet = ['allergy_intolerance_concerns', 'vegan_status', 'vegetarian_status', 'gluten_relevance', 'who_should_be_aware'].some((key) => record[key]);
  const hasAdditional = additionalFields.some(([key]) => record[key]) || record.related_ingredients || extras.length;

  return (
    <article className="food-detail-card food-detail-ingredient">
      {/* A. Ingredient overview */}
      <header className="food-hero">
        <div className="food-hero-main">
          <div className="food-hero-badges"><TypeBadge type="ingredient" />{record.processing_level && <span className="food-processing-tag">{record.processing_level}</span>}</div>
          <h1>{record.ingredient_name}</h1>
          <p className="food-hero-category">{record.ingredient_category}{record.parent_ingredient && <> · <span>{record.parent_ingredient}</span></>}</p>
          {record.what_it_is && <p className="food-hero-lead">{record.what_it_is}</p>}
          {synonyms.length > 0 && <div className="food-synonyms"><span>Also known as</span><Chips items={synonyms} /></div>}
        </div>
      </header>

      <nav className="food-jump" aria-label="On this page">
        {hasNutrition && <a href="#nutrition">Nutrition</a>}<a href="#dietary">Dietary</a><a href="#processing">Processing</a>{record.better_alternatives && <a href="#alternatives">Alternatives</a>}{record.unboxed_summary && <a href="#unboxed-view">Unboxed View</a>}<a href="#evidence">References</a>
      </nav>

      <dl className="food-facts">
        {record.source && <div><dt><Icon name="leaf" />Source</dt><dd>{record.source}</dd></div>}
        {record.why_it_is_used && <div><dt><Icon name="process" />Why it is used</dt><dd>{record.why_it_is_used}</dd></div>}
        {record.parent_ingredient && <div><dt><Icon name="layers" />Parent ingredient</dt><dd>{record.parent_ingredient}</dd></div>}
        {record.processing_level && <div><dt><Icon name="process" />Processing level</dt><dd>{record.processing_level}</dd></div>}
      </dl>

      <div className="food-sections">
        {/* B. Nutritional information */}
        {hasNutrition && (
          <InfoSection icon="scale" title="Nutritional information" id="nutrition" intro="What this ingredient contributes, as described in the Ingredient Library. These are descriptions, not measured values for a particular product — check the nutrition label for amounts.">
            {record.main_nutritional_contribution && <p className="food-section-lead">{record.main_nutritional_contribution}</p>}
            <div className="food-nutrient-grid">
              <NutrientTile icon="egg" label="Protein" value={record.protein_relevance} />
              <NutrientTile icon="drop" label="Fat" value={record.fat_relevance} />
              <NutrientTile icon="bolt" label="Carbohydrate and sugar" value={record.carbohydrate_sugar_relevance} />
              <NutrientTile icon="fibre" label="Fibre" value={record.fibre_relevance} />
            </div>
          </InfoSection>
        )}

        {/* C. Understanding the ingredient */}
        {hasUnderstanding && (
          <InfoSection icon="info" title="Understanding the ingredient" intro="Where you’ll find it and how it may relate to your body.">
            <div className="food-field-grid">
              <Field icon="basket" label="Commonly found in" value={record.commonly_found_in} list />
              {labelNames.length > 0 && <div className="food-field"><h3><Icon name="tag" />Label names to look for</h3><Chips items={labelNames} /></div>}
              <Field icon="pulse" label="Blood sugar" value={record.blood_sugar_relevance} />
              <Field icon="gut" label="Digestion and gut" value={record.gut_relevance} />
              <Field icon="evidence" label="Inflammation" value={record.inflammation_relevance} />
            </div>
          </InfoSection>
        )}

        {/* D. Dietary considerations */}
        {hasDiet && (
          <InfoSection icon="people" title="Dietary considerations" id="dietary">
            <div className="food-diet-grid">
              <DietStatus label="Vegan" value={record.vegan_status} />
              <DietStatus label="Vegetarian" value={record.vegetarian_status} />
            </div>
            <div className="food-field-grid">
              <Field icon="alert" label="Allergens and intolerances" value={record.allergy_intolerance_concerns} />
              <Field icon="wheat" label="Gluten" value={record.gluten_relevance} />
              <Field icon="people" label="Who should be aware" value={record.who_should_be_aware} />
            </div>
          </InfoSection>
        )}

        {/* E. Processing and food quality */}
        <InfoSection icon="process" title="Processing and food quality" id="processing">
          <div className="food-processing">
            {record.processing_level && <div><span>This ingredient</span><strong>{record.processing_level}</strong></div>}
            {record.nova_relevance && <div><span>NOVA relevance</span><strong>{record.nova_relevance}</strong></div>}
          </div>
          <p className="food-muted-note">
            <Icon name="info" />
            The processing level describes this ingredient on its own. NOVA groups classify foods and finished products, so a product that contains this ingredient can sit in a different NOVA group depending on everything else in it and how it is made.
          </p>
        </InfoSection>

        {/* F. Better alternatives */}
        {record.better_alternatives && (
          <InfoSection icon="swap" title="Better alternatives" tone="green" id="alternatives">
            <Field label="Suggested swaps" value={record.better_alternatives} list />
          </InfoSection>
        )}
      </div>

      {/* G. The Unboxed View */}
      {(record.unboxed_summary || record.unboxed_classification) && (
        <section className="unboxed-view food-unboxed-view" id="unboxed-view">
          <span className="unboxed-eye" aria-hidden="true"><Icon name="eye" /></span>
          <div>
            <p className="food-view-label">Our interpretation</p>
            <h3>The Unboxed View</h3>
            {record.unboxed_classification && <p className="food-view-classification">{record.unboxed_classification}</p>}
            {record.unboxed_summary && <p>{record.unboxed_summary}</p>}
            <small>This is Unboxed Together’s plain-English view. It sits alongside, and does not replace, the scientific and regulatory sources below.</small>
          </div>
        </section>
      )}

      {/* H. Evidence and references */}
      <InfoSection icon="book" title="Evidence and references" id="evidence">
        <div className="food-evidence-grid">
          <Field label="Evidence quality" value={record.evidence_quality} />
          <Field label="Last reviewed" value={formatReviewed(record.last_reviewed)} />
        </div>
        {record.regulatory_notes && <div className="food-note"><Icon name="shield" /><div><h3>Regulatory notes</h3><p>{record.regulatory_notes}</p></div></div>}
        <References urls={references} />
        {otherReferenceText && <p className="food-muted-note"><Icon name="book" />{otherReferenceText}</p>}
      </InfoSection>

      {/* I. Additional information */}
      {hasAdditional && (
        <details className="food-details food-additional">
          <summary>Additional information</summary>
          <dl>
            <div><dt>Library ID</dt><dd>{record.ingredient_id}</dd></div>
            {record.related_ingredients && (
              <div>
                <dt>Related ingredients</dt>
                <dd>
                  {record.related_ingredients}
                  {record.related?.length > 0 && <span className="food-related">{record.related.map((item) => <Link key={item.id} href={`/ingredients/${item.slug}`}>{item.name}</Link>)}</span>}
                </dd>
              </div>
            )}
            {additionalFields.map(([key, label]) => record[key] && <div key={key}><dt>{label}</dt><dd>{record[key]}</dd></div>)}
            {extras.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
        </details>
      )}
    </article>
  );
}

export default function IngredientPage() {
  const { status, data, error, path, slug } = useFoodRecord('ingredient');
  const name = data?.record?.ingredient_name || data?.preview?.name;

  return (
    <Layout>
      <SEO
        title={name ? `${name} | Unboxed Food Database` : 'Ingredient | Unboxed Food Database'}
        description={name ? `What ${name} is, where it is used, its nutritional relevance and dietary considerations, from the Unboxed Food Database.` : 'An ingredient profile from the Unboxed Food Database.'}
        path={`/ingredients/${slug}`}
      />
      <div className="additive-page food-page food-detail-page">
        <DetailTopBar />
        <div className="food-detail-wrap">
          {status === 'loading' && <BrandLoader label="Loading ingredient…" />}
          {status === 'missing' && <section className="additive-empty-state"><h2>We couldn’t find that ingredient</h2><p>It may have been renamed or is still being reviewed. Try searching for it above.</p></section>}
          {status === 'error' && <section className="additive-error" role="alert"><strong>We couldn’t load this ingredient.</strong><p>{error}</p></section>}
          {status === 'ready' && (data.authenticated ? <IngredientProfile record={data.record} /> : <MembersOnly preview={data.preview} path={path} />)}
        </div>
      </div>
    </Layout>
  );
}
