-- Copies each member's current welcome questionnaire answers into the permanent
-- history as their first recorded version. Earlier edits were overwritten
-- before history existed and cannot be recovered; these rows are marked
-- source = 'backfill' so that is clear. No scores are created.
--
-- The welcome tables use FORCE ROW LEVEL SECURITY, which hides their rows from
-- the table owner running this migration. It is lifted for the copy only and
-- restored straight afterwards.

ALTER TABLE member_welcome_details NO FORCE ROW LEVEL SECURITY;
ALTER TABLE member_health_information NO FORCE ROW LEVEL SECURITY;

INSERT INTO member_form_submissions (user_id, form_type, form_version, answers, idempotency_key, source, submitted_at)
SELECT user_id, 'welcome_details', 'welcome-v1', answers, gen_random_uuid(), 'backfill', updated_at
FROM member_welcome_details;

INSERT INTO member_form_submissions (user_id, form_type, form_version, answers, idempotency_key, source, submitted_at)
SELECT h.user_id, page.form_type, 'welcome-v1',
  COALESCE((SELECT jsonb_object_agg(key, value) FROM jsonb_each(h.answers) WHERE key = ANY(page.keys)), '{}'::jsonb),
  gen_random_uuid(), 'backfill', page.saved_at
FROM member_health_information h
CROSS JOIN LATERAL (VALUES
  ('welcome_food', h.section_2_saved_at, ARRAY['breakfast', 'lunch', 'eveningMeal', 'snacks', 'foodLikes', 'foodAvoids', 'foodSources', 'foodSourcesOther', 'readyMealDays', 'takeawayDays', 'cookedMealDays', 'waterAmount', 'waterContainerSize', 'tea', 'coffee', 'energyDrinks', 'otherDrinks', 'drinkSizeOrBrand', 'lastCaffeinatedDrink', 'alcohol', 'alcoholDays', 'alcoholDetails']),
  ('welcome_everyday', h.section_3_saved_at, ARRAY['weekActivities', 'weekActivitiesOther', 'shoppingDifficulties', 'shoppingHelp', 'supportFormats', 'supportOther', 'sleepHours', 'bedtime', 'wakeTime', 'sleepPattern', 'movementDays', 'activitiesEnjoyed', 'moodScore', 'energyScore', 'sleepQualityScore', 'focusScore', 'managingDemandsScore', 'cookingConfidenceScore', 'easierNextMonth', 'baselineDate']),
  ('welcome_health', h.section_4_saved_at, ARRAY['joiningExperiences', 'joiningExperiencesDetail', 'healthConditionsChoice', 'healthConditionsDetail', 'allergiesChoice', 'allergiesDetail', 'medicinesChoice', 'medicinesDetail', 'otherFoodSupportFactors', 'existingAdvice', 'anythingElseForLee'])
) AS page(form_type, saved_at, keys)
WHERE page.saved_at IS NOT NULL;

ALTER TABLE member_welcome_details FORCE ROW LEVEL SECURITY;
ALTER TABLE member_health_information FORCE ROW LEVEL SECURITY;

INSERT INTO member_record_events (user_id, actor_user_id, actor_role, action, form_type, resource_id, created_at)
SELECT user_id, 'migration-010', 'system', 'backfilled', form_type, id, NOW()
FROM member_form_submissions WHERE source = 'backfill';
