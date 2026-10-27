-- Expands the Food Database with the Unboxed Ingredient Library (UIL codes).
-- The existing additives table is not altered. A read-only snapshot of it is
-- taken first so its content can be compared against the live table at any time.

CREATE TABLE additives_backup_2026_10_27 AS TABLE additives;
COMMENT ON TABLE additives_backup_2026_10_27 IS 'Snapshot of additives taken before the Ingredient Library was added (migration 017). Not used by the site.';

CREATE TABLE ingredient_import_batches (
  id BIGSERIAL PRIMARY KEY,
  source_name TEXT NOT NULL,
  source_fingerprint TEXT,
  imported_by TEXT NOT NULL,
  created_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  unchanged_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per UIL code. Every column of the Ingredient Library master file has
-- its own column; any column added to the file later is kept in extra_fields.
-- internal_notes is editorial and is only ever returned to the team area.
CREATE TABLE ingredients (
  ingredient_id TEXT PRIMARY KEY CHECK (ingredient_id ~ '^UIL-[0-9]{4,}$'),
  slug TEXT NOT NULL UNIQUE,
  ingredient_name TEXT NOT NULL,
  alternative_names TEXT NOT NULL DEFAULT '',
  ingredient_category TEXT NOT NULL DEFAULT '',
  parent_ingredient TEXT NOT NULL DEFAULT '',
  what_it_is TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  why_it_is_used TEXT NOT NULL DEFAULT '',
  processing_level TEXT NOT NULL DEFAULT '',
  main_nutritional_contribution TEXT NOT NULL DEFAULT '',
  protein_relevance TEXT NOT NULL DEFAULT '',
  fat_relevance TEXT NOT NULL DEFAULT '',
  carbohydrate_sugar_relevance TEXT NOT NULL DEFAULT '',
  fibre_relevance TEXT NOT NULL DEFAULT '',
  blood_sugar_relevance TEXT NOT NULL DEFAULT '',
  gut_relevance TEXT NOT NULL DEFAULT '',
  inflammation_relevance TEXT NOT NULL DEFAULT '',
  allergy_intolerance_concerns TEXT NOT NULL DEFAULT '',
  who_should_be_aware TEXT NOT NULL DEFAULT '',
  commonly_found_in TEXT NOT NULL DEFAULT '',
  label_names TEXT NOT NULL DEFAULT '',
  better_alternatives TEXT NOT NULL DEFAULT '',
  vegan_status TEXT NOT NULL DEFAULT '',
  vegetarian_status TEXT NOT NULL DEFAULT '',
  gluten_relevance TEXT NOT NULL DEFAULT '',
  nova_relevance TEXT NOT NULL DEFAULT '',
  unboxed_classification TEXT NOT NULL DEFAULT '',
  evidence_quality TEXT NOT NULL DEFAULT '',
  regulatory_notes TEXT NOT NULL DEFAULT '',
  unboxed_summary TEXT NOT NULL DEFAULT '',
  scanner_matching_terms TEXT NOT NULL DEFAULT '',
  common_misspellings TEXT NOT NULL DEFAULT '',
  related_ingredients TEXT NOT NULL DEFAULT '',
  related_additives TEXT NOT NULL DEFAULT '',
  reference_sources TEXT NOT NULL DEFAULT '',
  last_reviewed DATE,
  internal_notes TEXT NOT NULL DEFAULT '',
  extra_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  publish_ready BOOLEAN NOT NULL DEFAULT TRUE,
  import_batch_id BIGINT REFERENCES ingredient_import_batches (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX ingredients_name_unique_idx ON ingredients (LOWER(ingredient_name));
CREATE INDEX ingredients_category_idx ON ingredients (LOWER(ingredient_category));
CREATE INDEX ingredients_publish_ready_idx ON ingredients (publish_ready);
