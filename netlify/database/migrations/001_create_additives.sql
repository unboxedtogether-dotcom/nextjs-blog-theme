CREATE TABLE additives (
  ual_id TEXT PRIMARY KEY,
  e_number TEXT NOT NULL,
  additive_name TEXT NOT NULL,
  category TEXT NOT NULL,
  food_function TEXT NOT NULL,
  risk_indicator TEXT NOT NULL,
  attention_level TEXT NOT NULL,
  found_in TEXT NOT NULL,
  peak_exposure TEXT NOT NULL,
  processing TEXT NOT NULL,
  typical_clearance TEXT NOT NULL,
  adi TEXT NOT NULL,
  evidence_suggests TEXT NOT NULL,
  stacking_factors TEXT NOT NULL,
  who_should_be_aware TEXT NOT NULL,
  natural_alternatives TEXT NOT NULL,
  uk_regulatory_status TEXT NOT NULL,
  sources TEXT NOT NULL,
  unboxed_view TEXT NOT NULL,
  evidence_strength TEXT NOT NULL,
  research_status TEXT NOT NULL,
  source_url_uk_list TEXT NOT NULL,
  source_url_fsa TEXT NOT NULL,
  source_url_efsa TEXT NOT NULL,
  last_reviewed DATE NOT NULL,
  evidence_notes TEXT NOT NULL,
  publish_ready BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX additives_e_number_idx ON additives (LOWER(e_number));
CREATE INDEX additives_name_idx ON additives (LOWER(additive_name));
CREATE INDEX additives_publish_ready_idx ON additives (publish_ready);
