-- Each baseline and weekly check-in now carries the date the member chose for
-- it (the day the answers describe), separate from when it was saved. The
-- reporting week is the Monday-to-Sunday week containing that date, so a
-- member can also add a check-in for an earlier week they missed.
--
-- Existing records get a date from what is already stored: the baseline date
-- for baselines, and the UK date they were saved for weekly check-ins. History
-- rows are otherwise unchanged. The append-only trigger is paused for this
-- one-off backfill only and switched straight back on.

ALTER TABLE member_form_submissions ADD COLUMN entry_date DATE;

ALTER TABLE member_form_submissions DISABLE TRIGGER member_form_submissions_no_update;

UPDATE member_form_submissions s SET entry_date = b.baseline_date
FROM member_baselines b
WHERE s.form_type = 'baseline_wellbeing' AND b.user_id = s.user_id;

UPDATE member_form_submissions SET entry_date = timezone('Europe/London', submitted_at)::date
WHERE entry_date IS NULL AND form_type IN ('baseline_wellbeing', 'weekly_checkin');

ALTER TABLE member_form_submissions ENABLE TRIGGER member_form_submissions_no_update;

-- The chosen date must sit inside the record's reporting week. NOT VALID keeps
-- the migration safe for older rows; every new row is checked.
ALTER TABLE member_form_submissions ADD CONSTRAINT member_form_submissions_entry_date_in_week
  CHECK (entry_date IS NULL OR reporting_week_start IS NULL OR entry_date BETWEEN reporting_week_start AND reporting_week_start + 6) NOT VALID;

CREATE INDEX member_form_submissions_entry_date_idx ON member_form_submissions (user_id, entry_date DESC) WHERE entry_date IS NOT NULL;
