-- Book reviews submitted through the website. Kept separate from member
-- profiles and health information; nothing here references member data
-- beyond an optional Identity user id for reviews written while logged in.
-- Reviews are never published automatically: every row starts as 'pending'.

CREATE TABLE book_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 80),
  email TEXT NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254),
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  headline TEXT NOT NULL CHECK (char_length(headline) BETWEEN 1 AND 120),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  purchase_location TEXT CHECK (purchase_location IS NULL OR char_length(purchase_location) <= 120),
  publication_consent BOOLEAN NOT NULL CHECK (publication_consent),
  consent_given_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  member_user_id TEXT,
  -- Daily-rotating hash used only for rate limiting; raw IP addresses are not stored.
  submitter_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  moderated_at TIMESTAMPTZ,
  moderated_by TEXT
);

CREATE INDEX book_reviews_status_idx ON book_reviews (status, published_at DESC);
CREATE INDEX book_reviews_created_at_idx ON book_reviews (created_at DESC);
CREATE INDEX book_reviews_submitter_idx ON book_reviews (submitter_hash, created_at DESC);
CREATE INDEX book_reviews_email_idx ON book_reviews (lower(email), created_at DESC);

-- Only the site's own functions (connecting as the table owner) can read or
-- write reviews. The restricted member role gets no access at all.
ALTER TABLE book_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON book_reviews FROM PUBLIC;
